const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Space = require("../models/Space");
const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const Announcement = require("../models/Announcement");

const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");

const PlanInheritanceService = require("./planInheritanceService").default;
const EntitlementService = require("./entitlementService").default;
interface CreateWorkspaceData {
  name: string;
  owner: string;
}

class WorkspaceService {
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
      .populate("members.user", "name email profilePicture")
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
      .populate("members.user", "name email profilePicture");

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

    if (workspace.owner.toString() !== userId) {
      throw new AppError("Only workspace owner can update this workspace", 403);
    }

    const oldValue = workspace.toObject();

    if (updateData.name) {
      workspace.name = updateData.name;
    }

    if (updateData.logo) {
      workspace.logo = updateData.logo;
    }

    await workspace.save();

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

  async getWorkspaceAnalytics(workspaceId: string, userId: string) {
    // Import services inside the method to avoid circular dependencies
    const HierarchyService = require("./hierarchyService").default;
    const analyticsService = require("./analyticsService");
    const activityService = require("./activityService");
    const performanceService = require("./performanceService");
    const stickyNoteService = require("./stickyNoteService");

    // 1. Fetch Workspace & Members (populated for UI badges/avatars)
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    })
      .populate("owner", "name email profilePicture")
      .populate("members.user", "name email profilePicture")
      .lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // 2. Fetch stats (also performs security/access check)
    const stats = await analyticsService.getWorkspaceOverview(workspaceId, userId);

    // Get user's role for permission check
    const isOwner = workspace.owner._id.toString() === userId;
    const memberObj = workspace.members.find((m: any) => m.user._id.toString() === userId);
    const userRole = isOwner ? 'owner' : (memberObj?.role || 'member');

    // 3. Fetch Hierarchy Tree (Optimized single aggregation with permission check)
    const hierarchy = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId, userRole);

    // 3. Fetch Latest Announcements
    const announcements = await Announcement.find({ 
      workspace: workspaceId 
    })
      .populate("author", "name email profilePicture")
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

    // 5. Fetch recent tasks across workspace (top 100 for immediate dashboard visibility)
    const recentTasks = await Task.find({ 
      workspace: workspaceId, 
      isDeleted: false 
    })
      .select("_id title status priority assignee space list updatedAt")
      .populate("assignee", "name email profilePicture")
      .sort("-updatedAt")
      .limit(100)
      .lean();

    // 6. Fetch Sticky Note for this user
    const stickyNote = await stickyNoteService.getStickyNote(workspaceId, userId);

    // 7. Fetch Recent Activity (last 20 items)
    const recentActivity = await activityService.getActivities({
      workspaceId,
      limit: 20
    });

    // 8. Fetch Performance Metrics
    const userPerformance = await performanceService.getUserPerformance(userId, workspaceId);
    
    // 9. Fetch Team Performance (for admins/owners only)
    let teamPerformance = null;
    const isAdmin = isOwner || (memberObj && (memberObj.role === 'admin' || memberObj.role === 'owner'));
    
    if (isAdmin) {
      teamPerformance = await performanceService.getTeamPerformance(workspaceId);
    }

    // 10. Fetch Velocity (last 30 days)
    const velocity = await analyticsService.getVelocity(workspaceId, userId, 30);

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
      hierarchy: hierarchy.spaces,
      members: workspace.members.map((member: any) => {
        // Check if member has an active timer in this workspace
        const hasActiveTimer = activeUserIds.has(member.user._id.toString());
        return {
          ...member,
          status: hasActiveTimer ? "active" : "inactive"
        };
      }).sort((a: any, b: any) => (a.status === "active" ? -1 : 1)),
      tasks: recentTasks,
      announcements,
      currentRunningTimer,
      stickyNote,
      recentActivity,
      performance: {
        user: userPerformance,
        team: teamPerformance
      },
      velocity
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

    // Populate the member user data for the response
    await workspace.populate("members.user", "name email profilePicture");

    // Find and return the updated member
    const updatedMember = workspace.members.find((m: any) => m.user._id.toString() === memberId);

    return updatedMember;
  }
}

module.exports = new WorkspaceService();
export {};