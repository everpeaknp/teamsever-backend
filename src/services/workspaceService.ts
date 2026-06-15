const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Space = require("../models/Space");
const List = require("../models/List");
const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const Announcement = require("../models/Announcement");

const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
const PermissionService = require("../permissions/permission.service");

const PlanInheritanceService = require("./planInheritanceService").default;
const EntitlementService = require("./entitlementService").default;
const analyticsV2CacheService = require("./analyticsV2CacheService");
import { resolveAnalyticsViewAccess } from "../permissions/analyticsAccess";
interface CreateWorkspaceData {
  name: string;
  owner: string;
}

class WorkspaceService {
  private buildDateRange(
    from?: string,
    to?: string,
    options?: { defaultToday?: boolean }
  ): { $gte?: Date; $lte?: Date } | null {
    const range: { $gte?: Date; $lte?: Date } = {};

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        d.setUTCHours(0, 0, 0, 0);
        range.$gte = d;
      }
    }

    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setUTCHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }

    if (!from && !to && options?.defaultToday) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      return { $gte: start, $lte: end };
    }

    return Object.keys(range).length > 0 ? range : null;
  }
  async createWorkspace(data: CreateWorkspaceData) {
    // Check workspace limit before creating
    const user = await User.findById(data.owner).populate('subscription.planId');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get user's plan - either their paid plan or the free plan
    let planToUse = null;
    
    if (user.subscription?.isPaid && user.subscription.planId) {
      // User has a paid subscription
      planToUse = user.subscription.planId;
    } else {
      // User is on free plan - fetch the free plan from database
      const freePlan = await Plan.findOne({ 
        name: { $regex: /free/i }, 
        isActive: true 
      });
      
      if (!freePlan) {
        // If no free plan exists, allow creation (backward compatibility)
        const workspace = await Workspace.create({
          name: data.name,
          owner: data.owner,
          members: [
            {
              user: data.owner,
              role: "owner",
              status: "inactive"
            }
          ]
        });

        await logger.logActivity({
          userId: data.owner,
          workspaceId: workspace._id.toString(),
          action: "CREATE",
          resourceType: "Workspace",
          resourceId: workspace._id.toString(),
          metadata: { name: workspace.name }
        });

        return workspace;
      }
      
      planToUse = freePlan;
    }
    
    // Get resolved features from plan
    const resolvedFeatures = await PlanInheritanceService.resolveFeatures(planToUse);
    const maxWorkspaces = resolvedFeatures.maxWorkspaces || 1;
    
    // Count current workspaces owned by user
    const currentWorkspaceCount = await Workspace.countDocuments({
      owner: data.owner,
      isDeleted: false
    });

    
    // Check if limit is reached (only if not unlimited)
    if (maxWorkspaces !== -1 && currentWorkspaceCount >= maxWorkspaces) {
      throw new AppError(
        `Workspace limit reached (${currentWorkspaceCount}/${maxWorkspaces}). Upgrade your plan to create more workspaces.`,
        400,
        'WORKSPACE_LIMIT_REACHED'
      );
    }
    
    const workspace = await Workspace.create({
      name: data.name,
      owner: data.owner,
      members: [
        {
          user: data.owner,
          role: "owner",
          status: "inactive" // Owner starts clocked out by default
        }
      ]
    });

    await logger.logActivity({
      userId: data.owner,
      workspaceId: workspace._id.toString(),
      action: "CREATE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString(),
      metadata: { name: workspace.name }
    });

    // Invalidate usage cache for user
    EntitlementService.invalidateUsageCache(data.owner);

    return workspace;
  }

  async getUserWorkspaces(userId: string) {
    const userObjId = new mongoose.Types.ObjectId(userId);
    const workspaces = await Workspace.find({
      isDeleted: false,
      $or: [{ owner: userObjId }, { "members.user": userObjId }]
    })
      .populate({
        path: "owner",
        select: "name email profilePicture subscription",
        populate: {
          path: "subscription.planId",
          model: "Plan"
        }
      })
      .populate("members.user", "name email avatar profilePicture")
      .populate("members.customRole")
      .sort("-createdAt");

    // Transform workspaces to include subscription at workspace level
    const transformedWorkspaces = await Promise.all(workspaces.map(async (workspace: any) => {
      const workspaceObj = workspace.toObject();
      
      if (workspaceObj.owner && workspaceObj.owner.subscription && workspaceObj.owner.subscription.planId) {
        // Use plan features directly
        const planFeatures = workspaceObj.owner.subscription.planId.features;
        
        workspaceObj.subscription = {
          isPaid: workspaceObj.owner.subscription.isPaid,
          status: workspaceObj.owner.subscription.status,
          plan: workspaceObj.owner.subscription.planId,
          resolvedFeatures: planFeatures
        };
      } else {
        // Use free plan
        const freePlan = await Plan.findOne({ 
          name: { $regex: /free/i }, 
          isActive: true 
        });
        
        if (freePlan) {
          workspaceObj.subscription = {
            isPaid: false,
            status: 'free',
            plan: freePlan,
            resolvedFeatures: freePlan.features
          };
        }
      }
      
      return workspaceObj;
    }));
    
    return transformedWorkspaces;
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    })
      .populate({
        path: "owner",
        select: "name email profilePicture subscription",
        populate: {
          path: "subscription.planId",
          model: "Plan"
        }
      })
      .populate("members.user", "name email avatar profilePicture")
      .populate("members.customRole");

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const hasAccess =
      workspace.owner._id.toString() === userId ||
      workspace.members.some((member: any) => member.user._id.toString() === userId);

    if (!hasAccess) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Transform the response to include subscription at workspace level for easier access
    const workspaceObj = workspace.toObject();
    
    // Always try to get plan information
    let planFeatures = null;
    let planToUse = null;
    
    if (workspaceObj.owner && workspaceObj.owner.subscription && workspaceObj.owner.subscription.planId) {
      // Owner has a paid subscription - use their plan features directly
      planToUse = workspaceObj.owner.subscription.planId;
      planFeatures = planToUse.features;
      
      workspaceObj.subscription = {
        isPaid: workspaceObj.owner.subscription.isPaid,
        status: workspaceObj.owner.subscription.status,
        plan: planToUse,
        resolvedFeatures: planFeatures // Just use plan features directly
      };
    } else {
      // Owner doesn't have a paid subscription - use free plan
      const freePlan = await Plan.findOne({ 
        name: { $regex: /free/i }, 
        isActive: true 
      });
      
      if (freePlan) {
        workspaceObj.subscription = {
          isPaid: false,
          status: 'free',
          plan: freePlan,
          resolvedFeatures: freePlan.features
        };
      } else {
        // No free plan found, provide default values
        workspaceObj.subscription = {
          isPaid: false,
          status: 'free',
          plan: null,
          resolvedFeatures: {
            maxWorkspaces: 1,
            maxMembers: 2,
            maxAdmins: 1,
            maxSpaces: 2,
            maxLists: 4,
            maxFolders: 2,
            maxTasks: 100,
            hasAccessControl: false,
            hasGroupChat: false,
            messageLimit: 0,
            announcementCooldown: 24,
            accessControlTier: 'none',
            canUseCustomRoles: false,
            maxCustomRoles: 0,
            canCreateTables: false,
            maxTablesCount: 0,
            maxRowsLimit: 0,
            maxColumnsLimit: 0,
            maxFiles: 0,
            maxDocuments: 0,
            maxDirectMessagesPerUser: 0
          }
        };
      }
    }

    return workspaceObj;
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    if (workspace.owner.toString() !== userId) {
      throw new AppError("Only workspace owner can delete this workspace", 403);
    }

    await softDelete(Workspace, workspaceId);

    // Invalidate usage cache for workspace owner
    EntitlementService.invalidateUsageCache(workspace.owner.toString());

    await logger.logActivity({
      userId,
      workspaceId: workspace._id.toString(),
      action: "DELETE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString()
    });

    return { message: "Workspace deleted successfully" };
  }

  async updateWorkspace(workspaceId: string, userId: string, updateData: { name?: string; logo?: string }) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Check if user is owner or has administrative role
    const isOwner = workspace.owner.toString() === userId;
    const member = workspace.members.find((m: any) => m.user.toString() === userId);
    const isAdmin = isOwner || (member && (member.role === 'admin' || member.role === 'operations_manager'));

    if (!isAdmin) {
      throw new AppError("Only workspace owner or admins can update this workspace", 403);
    }

    const oldValue = workspace.toObject();

    if (updateData.name) {
      workspace.name = updateData.name;
    }

    if (updateData.logo) {
      workspace.logo = updateData.logo;
    }

    await workspace.save();
    await analyticsV2CacheService.invalidateWorkspace(workspaceId);

    await logger.logAudit({
      userId,
      workspaceId: workspace._id.toString(),
      resourceType: "Workspace",
      resourceId: workspace._id.toString(),
      oldValue,
      newValue: workspace.toObject()
    });

    await logger.logActivity({
      userId,
      workspaceId: workspace._id.toString(),
      action: "UPDATE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString()
    });

    return workspace;
  }

  async getWorkspaceAnalytics(
    workspaceId: string,
    userId: string,
    requestedView?: string,
    period?: {
      from?: string;
      to?: string;
      activityLimit?: number;
      activitySkip?: number;
      includeTeamPerformance?: boolean;
    }
  ) {
    // Import services inside the method to avoid circular dependencies
    const analyticsService = require("./analyticsService");
    const activityService = require("./activityService");
    const performanceService = require("./performanceService");
    const stickyNoteService = require("./stickyNoteService");
    const createdAtRange = this.buildDateRange(period?.from, period?.to, { defaultToday: false });
    const activityLimit = Math.min(50, Math.max(1, Number(period?.activityLimit || 10)));
    const activitySkip = Math.max(0, Number(period?.activitySkip || 0));

    // 1. Fetch Workspace & Members (populated for UI badges/avatars)
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    })
      .populate("owner", "name email avatar profilePicture")
      .populate("members.user", "name email avatar profilePicture")
      .populate("members.customRole")
      .lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Get user's role for hierarchy/view shaping
    const isOwner = workspace.owner._id.toString() === userId;
    const memberObj = workspace.members.find((m: any) => m.user._id.toString() === userId);
    const userRole = isOwner ? 'owner' : (memberObj?.role || 'member');
    const canViewPersonalAnalytics = await PermissionService.can(
      userId,
      "VIEW_ANALYTICS_PERSONAL",
      { userId, workspaceId }
    );
    const canViewTeamAnalytics = await PermissionService.can(
      userId,
      "VIEW_ANALYTICS_TEAM",
      { userId, workspaceId }
    );
    const canViewAnnouncements = await PermissionService.can(
      userId,
      "VIEW_ANNOUNCEMENT",
      { userId, workspaceId }
    );
    const canCreateAnnouncements = await PermissionService.can(
      userId,
      "CREATE_ANNOUNCEMENT",
      { userId, workspaceId }
    );
    const canDeleteAnnouncements = await PermissionService.can(
      userId,
      "DELETE_ANNOUNCEMENT",
      { userId, workspaceId }
    );

    let analyticsAccess;
    try {
      analyticsAccess = resolveAnalyticsViewAccess({
        requestedView,
        canViewPersonalAnalytics,
        canViewTeamAnalytics
      });
    } catch (_error) {
      throw new AppError("You do not have permission to view analytics", 403);
    }
    const normalizedView = requestedView === "personal" || requestedView === "workspace" ? requestedView : undefined;
    const effectiveView: "workspace" | "personal" = analyticsAccess.effectiveView;

    // 3. Fetch Latest Announcements
    // Announcements are workspace feed items and should always show latest posts,
    // independent of analytics task date filtering (from/to).
    const announcements = await Announcement.find({ workspace: workspaceId })
      .populate("author", "name email avatar profilePicture")
      .sort("-createdAt")
      .limit(10)
      .lean();

    // 4. Fetch the specific running timer for the current user
    const currentRunningTimer = await TimeEntry.findOne({
      user: userId,
      workspace: workspaceId,
      isRunning: true,
      isDeleted: false
    })
      .select("_id startTime isRunning description task")
      .populate("task", "title")
      .sort("-startTime")
      .lean();

    // Build personal time-tracking summary once here so dashboard widgets
    // do not fan out into separate attendance/report API calls.
    const nowUtc = new Date();
    const todayStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 23, 59, 59, 999));
    const day = nowUtc.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(todayStart.getUTCDate() - diffToMonday);
    const weekEnd = todayEnd;

    const [todayEntries, weekEntries, latestEntries] = await Promise.all([
      TimeEntry.find({
        workspace: workspaceId,
        user: userId,
        isDeleted: false,
        startTime: { $gte: todayStart, $lte: todayEnd }
      }).select("startTime endTime duration isRunning").lean(),
      TimeEntry.find({
        workspace: workspaceId,
        user: userId,
        isDeleted: false,
        startTime: { $gte: weekStart, $lte: weekEnd }
      }).select("startTime endTime duration isRunning").lean(),
      TimeEntry.find({
        workspace: workspaceId,
        user: userId,
        isDeleted: false
      }).select("startTime endTime").sort("-startTime").limit(20).lean()
    ]);

    const secondsForEntries = (entries: any[]) => {
      let total = 0;
      const nowMs = Date.now();
      for (const entry of entries || []) {
        if (typeof entry?.duration === "number" && entry.duration > 0) {
          total += entry.duration;
          continue;
        }
        const startMs = entry?.startTime ? new Date(entry.startTime).getTime() : NaN;
        if (Number.isNaN(startMs)) continue;
        if (entry?.isRunning || !entry?.endTime) {
          total += Math.max(0, Math.floor((nowMs - startMs) / 1000));
        } else {
          const endMs = new Date(entry.endTime).getTime();
          if (!Number.isNaN(endMs)) total += Math.max(0, Math.floor((endMs - startMs) / 1000));
        }
      }
      return total;
    };

    const todayTrackedSeconds = secondsForEntries(todayEntries as any[]);
    const weekTrackedSeconds = secondsForEntries(weekEntries as any[]);
    const formatHm = (seconds: number) => {
      const mins = Math.floor(Math.max(0, seconds) / 60);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    };

    let lastCheckIn: string | null = null;
    let lastCheckOut: string | null = null;
    for (const entry of latestEntries as any[]) {
      if (!lastCheckIn && entry?.startTime) lastCheckIn = new Date(entry.startTime).toISOString();
      if (!lastCheckOut && entry?.endTime) lastCheckOut = new Date(entry.endTime).toISOString();
      if (lastCheckIn && lastCheckOut) break;
    }

    // 5. Fetch tasks based on effective analytics scope
    const activeLists = await List.find({
      workspace: workspaceId,
      isDeleted: false
    }).select("_id").lean();
    const activeListIds = activeLists.map((l: any) => l._id);

    const taskQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      isDeleted: false
    };
    if (createdAtRange) taskQuery.createdAt = createdAtRange;
    if (effectiveView === "personal") {
      taskQuery.$or = [{ assignee: userId }, { createdBy: userId }];
    }

    const recentTasks = await Task.find(taskQuery)
      .select("_id title status priority assignee space list updatedAt deadline completedAt createdAt")
      .populate("assignee", "name email avatar profilePicture")
      .sort("-updatedAt")
      .lean();

    const isPrivilegedDashboardUser = ["owner", "admin", "operations_manager", "project_manager"].includes(userRole);
    let dashboardSpaces: any[] = [];

    if (isPrivilegedDashboardUser) {
      const spaceDocs = await Space.find({
        workspace: workspaceId,
        isDeleted: false
      })
        .select("_id name status color")
        .lean();

      const taskCountsBySpace = new Map<string, { totalTasks: number; completedTasks: number }>();
      for (const task of recentTasks as any[]) {
        const spaceId = task.space?.toString?.() || String(task.space || "");
        if (!spaceId) continue;
        const current = taskCountsBySpace.get(spaceId) || { totalTasks: 0, completedTasks: 0 };
        current.totalTasks += 1;
        if (String(task.status || "").toLowerCase() === "done") {
          current.completedTasks += 1;
        }
        taskCountsBySpace.set(spaceId, current);
      }

      dashboardSpaces = spaceDocs.map((space: any) => {
        const counts = taskCountsBySpace.get(space._id.toString()) || { totalTasks: 0, completedTasks: 0 };
        return {
          _id: space._id,
          name: space.name,
          status: space.status,
          color: space.color,
          totalTasks: counts.totalTasks,
          completedTasks: counts.completedTasks
        };
      });
    } else {
      const HierarchyService = require("./hierarchyService").default;
      const hierarchy = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId, userRole);
      dashboardSpaces = (hierarchy.spaces || []).map((space: any) => ({
        _id: space._id,
        name: space.name,
        status: space.status,
        color: space.color,
        totalTasks: space.totalTasks || 0,
        completedTasks: space.completedTasks || 0
      }));
    }

    // 6. Fetch Sticky Note for this user
    const stickyNote = await stickyNoteService.getStickyNote(workspaceId, userId);

    // 7. Fetch Recent Activity (last 20 items)
    const recentActivity = await activityService.getActivities({
      workspaceId,
      limit: activityLimit,
      skip: activitySkip,
      startDate: period?.from,
      endDate: period?.to
    });

    // 8. Fetch Performance Metrics
    const userPerformance = await performanceService.getUserPerformance(userId, workspaceId, period);
    
    // 2. Build stats from effective scope (workspace or personal)
    const now = new Date();
    const totalTasks = recentTasks.length;
    const completedTaskRows = recentTasks.filter((t: any) => t.status === "done");
    const completedTasks = completedTaskRows.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const openTaskRows = recentTasks.filter((t: any) => {
      const s = String(t.status || "").toLowerCase();
      return s !== "done" && s !== "cancelled";
    });
    const delayedOpenTasks = openTaskRows.filter((t: any) => t.deadline && new Date(t.deadline) < now).length;
    const delayedRate = openTaskRows.length > 0 ? Math.round((delayedOpenTasks / openTaskRows.length) * 100) : 0;
    const completedWithDeadlineRows = completedTaskRows.filter((t: any) => !!t.deadline);
    const completedOnTimeWithDeadline = completedWithDeadlineRows.filter((t: any) => {
      if (!t.completedAt || !t.deadline) return false;
      return new Date(t.completedAt) <= new Date(t.deadline);
    }).length;
    const deadlineCompletionRate = completedWithDeadlineRows.length > 0
      ? Math.round((completedOnTimeWithDeadline / completedWithDeadlineRows.length) * 100)
      : 100;
    const priorityBuckets: Record<string, number> = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
    const buildPriorityPerformance = (taskRows: any[]) => {
      const rowsByPriority: Record<string, any[]> = {
        high: [],
        medium: [],
        low: []
      };

      for (const task of taskRows) {
        const p = String(task.priority || "").toLowerCase();
        if (p === "high" || p === "urgent") rowsByPriority.high.push(task);
        else if (p === "medium") rowsByPriority.medium.push(task);
        else if (p === "low") rowsByPriority.low.push(task);
      }

      const summarize = (rows: any[]) => {
        const total = rows.length;
        const doneRows = rows.filter((t: any) => String(t.status || "").toLowerCase() === "done");
        const done = doneRows.length;
        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        const doneWithDeadline = doneRows.filter((t: any) => !!t.deadline);
        const onTimeDone = doneWithDeadline.filter((t: any) => {
          if (!t.completedAt || !t.deadline) return false;
          return new Date(t.completedAt) <= new Date(t.deadline);
        }).length;
        const deadlineSuccess = doneWithDeadline.length > 0
          ? Math.round((onTimeDone / doneWithDeadline.length) * 100)
          : 100;
        const delayedOpen = rows.filter((t: any) => {
          const s = String(t.status || "").toLowerCase();
          if (s === "done" || s === "cancelled") return false;
          if (!t.deadline) return false;
          return new Date(t.deadline) < now;
        }).length;
        return { total, done, completionRate, deadlineSuccess, delayedOpen };
      };

      return {
        high: summarize(rowsByPriority.high),
        medium: summarize(rowsByPriority.medium),
        low: summarize(rowsByPriority.low)
      };
    };
    const statusBuckets: Record<string, number> = { "To Do": 0, "In Progress": 0, Review: 0, Done: 0, Blocked: 0, Cancelled: 0 };
    for (const task of recentTasks as any[]) {
      const p = String(task.priority || "").toLowerCase();
      if (p === "low") priorityBuckets.Low++;
      else if (p === "medium") priorityBuckets.Medium++;
      else if (p === "high") priorityBuckets.High++;
      else if (p === "urgent") priorityBuckets.Urgent++;

      const s = String(task.status || "").toLowerCase();
      if (s === "todo") statusBuckets["To Do"]++;
      else if (s === "inprogress" || s === "in-progress") statusBuckets["In Progress"]++;
      else if (s === "review") statusBuckets.Review++;
      else if (s === "done") statusBuckets.Done++;
      else if (s === "blocked") statusBuckets.Blocked++;
      else if (s === "cancelled") statusBuckets.Cancelled++;
    }

    const stats = {
      totalTasks,
      completedTasks,
      completionRate,
      delayedOpenTasks,
      delayedRate,
      deadlineCompletionRate,
      priorityDistribution: Object.entries(priorityBuckets)
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      priorityPerformance: buildPriorityPerformance(recentTasks as any[]),
      personalPriorityPerformance: buildPriorityPerformance(
        (recentTasks as any[]).filter((t: any) => {
          const assigneeId = typeof t.assignee === "string" ? t.assignee : t.assignee?._id;
          return assigneeId?.toString?.() === userId;
        })
      ),
      statusDistribution: Object.entries(statusBuckets)
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
    };

    // 9. Fetch Team Performance (for workspace analytics view only)
    let teamPerformance = null;
    const includeTeamPerformance = period?.includeTeamPerformance === true;
    if (includeTeamPerformance && canViewTeamAnalytics && effectiveView === "workspace") {
      teamPerformance = await performanceService.getTeamPerformance(workspaceId, period);
    }

    // 10. Fetch Velocity (workspace for analytics-enabled users, otherwise personal timeline from scoped tasks)
    let velocity = [];
    if (effectiveView === "workspace" && canViewTeamAnalytics) {
      velocity = await analyticsService.getVelocity(workspaceId, userId, 30);
    } else {
      const dayMap: Record<string, number> = {};
      for (const task of recentTasks as any[]) {
        const date = new Date(task.updatedAt || task.createdAt || Date.now()).toISOString().split("T")[0];
        dayMap[date] = (dayMap[date] || 0) + 1;
      }
      velocity = Object.entries(dayMap)
        .map(([date, completed]) => ({ date, completed }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
    }

    // 11. Calculate Dynamic Availability for all members
    const activeTimers = await TimeEntry.find({
      workspace: workspaceId,
      isRunning: true,
      isDeleted: false
    }).select("user");
    const activeUserIds = new Set(activeTimers.map((t: any) => t.user.toString()));

    return {
      workspace: {
        id: workspaceId,
        name: workspace.name,
        logo: workspace.logo,
        owner: workspace.owner
      },
      stats,
      hierarchy: dashboardSpaces,
      // Team availability should remain meaningful for all users, so always return
      // workspace member presence state (active/inactive) regardless of analytics view mode.
      members: workspace.members.map((member: any) => {
        // Check if member has an active timer in this workspace
        const hasActiveTimer = activeUserIds.has(member.user._id.toString());
        return {
          user: member.user,
          role: member.role,
          customRoleTitle: member.customRoleTitle || null,
          customRole: member.customRole
            ? {
                _id: member.customRole._id,
                name: member.customRole.name
              }
            : null,
          status: hasActiveTimer ? "active" : "inactive"
        };
      }).sort((a: any, b: any) => (a.status === "active" ? -1 : 1)),
      tasks: recentTasks,
      announcements,
      currentRunningTimer,
      timeTrackingSummary: {
        todayTrackedSeconds,
        todayTracked: formatHm(todayTrackedSeconds),
        weekTrackedSeconds,
        weekTracked: formatHm(weekTrackedSeconds),
        weeklyTargetHours: 40,
        weekProgressPercent: Math.max(0, Math.min(100, Math.round((weekTrackedSeconds / (40 * 3600)) * 100))),
        lastCheckIn,
        lastCheckOut
      },
      stickyNote,
      recentActivity,
      recentActivityMeta: {
        limit: activityLimit,
        skip: activitySkip,
        returned: recentActivity.length,
        hasMore: recentActivity.length === activityLimit
      },
      performance: {
        user: userPerformance,
        team: teamPerformance
      },
      performanceMeta: {
        teamIncluded: includeTeamPerformance && canViewTeamAnalytics && effectiveView === "workspace"
      },
      velocity,
      view: {
        requested: normalizedView || null,
        effective: effectiveView,
        available: analyticsAccess.availableViews,
        canViewWorkspaceAnalytics: canViewTeamAnalytics,
        canViewPersonalAnalytics
      },
      permissions: {
        canViewAnnouncements,
        canCreateAnnouncements,
        canDeleteAnnouncements
      }
    };
  }

  async updateMemberCustomRole(workspaceId: string, memberId: string, customRoleTitle: string | null) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Find the member in the workspace
    const member = workspace.members.find((m: any) => m.user.toString() === memberId);

    if (!member) {
      throw new AppError("Member not found in this workspace", 404);
    }

    // Update the custom role title
    member.customRoleTitle = customRoleTitle;

    await workspace.save();
    await analyticsV2CacheService.invalidateWorkspace(workspaceId);

    // Populate the member user data for the response
    await workspace.populate("members.user", "name email avatar profilePicture");

    // Find and return the updated member
    const updatedMember = workspace.members.find((m: any) => m.user._id.toString() === memberId);

    return updatedMember;
  }
}

module.exports = new WorkspaceService();
export {};
