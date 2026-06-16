import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";
import xss from "xss";

const asyncHandler = require("../utils/asyncHandler");
const workspaceService = require("../services/workspaceService");
const HierarchyService = require("../services/hierarchyService").default;
const AppError = require("../utils/AppError");
const Announcement = require("../models/Announcement");
const performanceService = require("../services/performanceService");
const activityService = require("../services/activityService");
const analyticsV2CacheService = require("../services/analyticsV2CacheService");

// @desc    Create new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name } = req.body;

  if (!name) {
    throw new AppError("Please provide workspace name", 400);
  }

  const workspace = await workspaceService.createWorkspace({
    name,
    owner: req.user!.id
  });

  res.status(201).json({
    success: true,
    data: workspace
  });
});

// @desc    Get all user workspaces
// @route   GET /api/workspaces
// @access  Private
const getMyWorkspaces = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaces = await workspaceService.getUserWorkspaces(req.user!.id);

  res.status(200).json({
    success: true,
    data: workspaces
  });
});

// @desc    Get single workspace
// @route   GET /api/workspaces/:id
// @access  Private
const getWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  
  const workspace = await workspaceService.getWorkspaceById(req.params.id, req.user!.id);


  res.status(200).json({
    success: true,
    data: workspace
  });
});

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private
const updateWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, logo } = req.body;

  const workspace = await workspaceService.updateWorkspace(req.params.id, req.user!.id, { name, logo });

  res.status(200).json({
    success: true,
    data: workspace
  });
});

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:id
// @access  Private
const deleteWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await workspaceService.deleteWorkspace(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get workspace analytics data
// @route   GET /api/workspaces/:id/analytics
// @access  Private
const getWorkspaceAnalytics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestedView = typeof req.query.view === "string" ? req.query.view : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const analytics = await workspaceService.getWorkspaceAnalytics(req.params.id, req.user!.id, requestedView, { from, to });

  res.status(200).json({
    success: true,
    message: "Consolidated analytics data retrieved successfully",
    data: analytics
  });
});

const getWorkspaceAnalyticsV2 = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const requestedView = typeof req.query.view === "string" ? req.query.view : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const tz = typeof req.query.tz === "string" ? req.query.tz : "UTC";
  const cacheKey = analyticsV2CacheService.buildSummaryKey({
    workspaceId,
    userId: req.user!.id,
    view: requestedView,
    from,
    to
  });

  const cached = await analyticsV2CacheService.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Workspace analytics v2 retrieved successfully",
      data: cached
    });
  }

  const Workspace = require("../models/Workspace");
  const Task = require("../models/Task");
  const List = require("../models/List");
  const Space = require("../models/Space");
  const TimeEntry = require("../models/TimeEntry");

  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false })
    .select("_id name logo owner members")
    .populate("owner", "name email avatar profilePicture")
    .populate("members.user", "name email avatar profilePicture")
    .lean();
  if (!workspace) throw new AppError("Workspace not found", 404);

  const activeTimers = await TimeEntry.find({
    workspace: workspaceId,
    isRunning: true,
    isDeleted: false
  }).select("user").lean();
  const activeUserIds = new Set(activeTimers.map((t: any) => t.user.toString()));
  const members = (workspace.members || []).map((member: any) => ({
    user: member.user,
    role: member.role,
    customRoleTitle: member.customRoleTitle || null,
    status: activeUserIds.has(member.user._id.toString()) ? "active" : "inactive"
  }));
  const activeMembers = members.filter((m: any) => m.status === "active");
  const slimUser = (member: any) => ({
    _id: member?.user?._id,
    name: member?.user?.name || "Unknown User",
    profilePicture: member?.user?.profilePicture || member?.user?.avatar || null,
    status: member?.status || "inactive",
    role: member?.role || "member"
  });

  const activeLists = await List.find({ workspace: workspaceId, isDeleted: false }).select("_id").lean();
  const activeListIds = activeLists.map((l: any) => l._id);
  const createdAtRange = (() => {
    const range: any = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    return Object.keys(range).length ? range : null;
  })();

  const taskQuery: any = {
    workspace: workspaceId,
    list: { $in: activeListIds },
    isDeleted: false
  };
  if (createdAtRange) taskQuery.createdAt = createdAtRange;
  if (requestedView === "personal") {
    taskQuery.$or = [{ assignee: req.user!.id }, { createdBy: req.user!.id }];
  }

  const taskAgg = await Task.aggregate([
    { $match: taskQuery },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
        delayedOpenTasks: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $ne: ["$status", "cancelled"] },
                  { $ne: ["$deadline", null] },
                  { $lt: ["$deadline", new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        completedWithDeadline: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "done"] }, { $ne: ["$deadline", null] }] },
              1,
              0
            ]
          }
        },
        completedOnTime: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "done"] },
                  { $ne: ["$deadline", null] },
                  { $ne: ["$completedAt", null] },
                  { $lte: ["$completedAt", "$deadline"] }
                ]
              },
              1,
              0
            ]
          }
        },
        todoCount: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } },
        inProgressCount: { $sum: { $cond: [{ $in: ["$status", ["inprogress", "in-progress"]] }, 1, 0] } },
        reviewCount: { $sum: { $cond: [{ $eq: ["$status", "review"] }, 1, 0] } },
        blockedCount: { $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        lowPriorityCount: { $sum: { $cond: [{ $eq: ["$priority", "low"] }, 1, 0] } },
        mediumPriorityCount: { $sum: { $cond: [{ $eq: ["$priority", "medium"] }, 1, 0] } },
        highPriorityCount: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        urgentPriorityCount: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } }
      }
    }
  ]);
  const taskStats = taskAgg[0] || {};
  const totalTasks = Number(taskStats.totalTasks || 0);
  const completedTasks = Number(taskStats.completedTasks || 0);
  const delayedOpenTasks = Number(taskStats.delayedOpenTasks || 0);
  const completedWithDeadline = Number(taskStats.completedWithDeadline || 0);
  const completedOnTime = Number(taskStats.completedOnTime || 0);
  const deadlineCompletionRate = completedWithDeadline > 0 ? Math.round((completedOnTime / completedWithDeadline) * 100) : 100;
  const statusDistributionMap: Record<string, number> = {
    "To Do": Number(taskStats.todoCount || 0),
    "In Progress": Number(taskStats.inProgressCount || 0),
    Review: Number(taskStats.reviewCount || 0),
    Done: Number(taskStats.completedTasks || 0),
    Blocked: Number(taskStats.blockedCount || 0),
    Cancelled: Number(taskStats.cancelledCount || 0)
  };
  const priorityBuckets: Record<string, number> = {
    Low: Number(taskStats.lowPriorityCount || 0),
    Medium: Number(taskStats.mediumPriorityCount || 0),
    High: Number(taskStats.highPriorityCount || 0),
    Urgent: Number(taskStats.urgentPriorityCount || 0)
  };

  const spaceCount = await Space.countDocuments({ workspace: workspaceId, isDeleted: false });
  const teamRows = await performanceService.getTeamPerformance(workspaceId, { from, to });

  const nowUtc = new Date();
  const todayStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 23, 59, 59, 999));
  const day = nowUtc.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(todayStart.getUTCDate() - diffToMonday);
  const weekEnd = todayEnd;

  const [currentRunningTimer, todayEntries, weekEntries, latestEntries] = await Promise.all([
    TimeEntry.findOne({
      user: req.user!.id,
      workspace: workspaceId,
      isRunning: true,
      isDeleted: false
    })
      .select("_id startTime isRunning description task")
      .populate("task", "title")
      .sort("-startTime")
      .lean(),
    TimeEntry.find({
      workspace: workspaceId,
      user: req.user!.id,
      isDeleted: false,
      startTime: { $gte: todayStart, $lte: todayEnd }
    }).select("startTime endTime duration isRunning").lean(),
    TimeEntry.find({
      workspace: workspaceId,
      user: req.user!.id,
      isDeleted: false,
      startTime: { $gte: weekStart, $lte: weekEnd }
    }).select("startTime endTime duration isRunning").lean(),
    TimeEntry.find({
      workspace: workspaceId,
      user: req.user!.id,
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
  const formatHm = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };
  const todayTrackedSeconds = secondsForEntries(todayEntries as any[]);
  const weekTrackedSeconds = secondsForEntries(weekEntries as any[]);
  let lastCheckIn: string | null = null;
  let lastCheckOut: string | null = null;
  for (const entry of latestEntries as any[]) {
    if (!lastCheckIn && entry?.startTime) lastCheckIn = new Date(entry.startTime).toISOString();
    if (!lastCheckOut && entry?.endTime) lastCheckOut = new Date(entry.endTime).toISOString();
    if (lastCheckIn && lastCheckOut) break;
  }
  const topFive = [...(teamRows || [])]
    .sort((a: any, b: any) => {
      const successDiff = Number(b?.metrics?.deadlineSuccessRate || 0) - Number(a?.metrics?.deadlineSuccessRate || 0);
      if (successDiff !== 0) return successDiff;
      return Number(b?.metrics?.totalTasksFinished || 0) - Number(a?.metrics?.totalTasksFinished || 0);
    })
    .slice(0, 5)
    .map((entry: any) => ({
      user: {
        _id: entry?.user?._id,
        name: entry?.user?.name || "Unknown User",
        profilePicture: entry?.user?.profilePicture || entry?.user?.avatar || null
      },
      metrics: {
        totalTasksFinished: entry?.metrics?.totalTasksFinished || 0,
        deadlineSuccessRate: entry?.metrics?.deadlineSuccessRate || 0
      }
    }));

  const PermissionService = require("../permissions/permission.service");
  const canViewAnnouncements = await PermissionService.can(req.user!.id, "VIEW_ANNOUNCEMENT", { userId: req.user!.id, workspaceId });
  const canCreateAnnouncements = await PermissionService.can(req.user!.id, "CREATE_ANNOUNCEMENT", { userId: req.user!.id, workspaceId });
  const canDeleteAnnouncements = await PermissionService.can(req.user!.id, "DELETE_ANNOUNCEMENT", { userId: req.user!.id, workspaceId });

  const payload = {
    version: "v2",
    scope: {
      workspaceId: (workspace as any)?._id?.toString?.() || workspaceId,
      timezone: tz,
      from: from || null,
      to: to || null,
      view: {
        requested: requestedView === "personal" || requestedView === "workspace" ? requestedView : null,
        effective: requestedView === "personal" ? "personal" : "workspace",
        available: ["personal", "workspace"],
        canViewWorkspaceAnalytics: true,
        canViewPersonalAnalytics: true
      }
    },
    summary: {
      totalTeam: members.length,
      clockedIn: activeMembers.length,
      totalTasks,
      completedTasks,
      onTimeCompletionRate: deadlineCompletionRate,
      activeProjects: spaceCount
    },
    timeTracking: {
      currentRunningTimer: currentRunningTimer || null,
      summary: {
        todayTrackedSeconds,
        todayTracked: formatHm(todayTrackedSeconds),
        weekTrackedSeconds,
        weekTracked: formatHm(weekTrackedSeconds),
        weeklyTargetHours: 40,
        weekProgressPercent: Math.max(0, Math.min(100, Math.round((weekTrackedSeconds / (40 * 3600)) * 100))),
        lastCheckIn,
        lastCheckOut
      }
    },
    taskStatus: {
      totalTasks,
      completed: completedTasks,
      inProgress: statusDistributionMap["In Progress"],
      delayed: delayedOpenTasks,
      distribution: Object.entries(statusDistributionMap)
        .filter(([, value]) => value > 0)
        .map(([label, value]) => ({ label, value }))
    },
    priorityDistribution: {
      high: priorityBuckets.High,
      medium: priorityBuckets.Medium,
      low: priorityBuckets.Low,
      urgent: priorityBuckets.Urgent
    },
    projectHealth: { spaces: [] },
    teamAvailability: {
      liveNow: activeMembers.map(slimUser),
      clockedOut: members.filter((m: any) => m.status !== "active").map(slimUser),
      total: members.length
    },
    teamPerformancePreview: topFive,
    permissions: {
      canViewAnnouncements,
      canCreateAnnouncements,
      canDeleteAnnouncements
    }
  };

  await analyticsV2CacheService.set(cacheKey, payload, 45);

  res.status(200).json({
    success: true,
    message: "Workspace analytics v2 retrieved successfully",
    data: payload
  });
});

const getWorkspaceAnalyticsV2Details = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const requestedView = typeof req.query.view === "string" ? req.query.view : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const cacheKey = analyticsV2CacheService.buildSummaryKey({
    workspaceId,
    userId: `${req.user!.id}:details`,
    view: requestedView,
    from,
    to
  });
  const cached = await analyticsV2CacheService.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Workspace analytics v2 details retrieved successfully",
      data: cached
    });
  }

  const analytics = await workspaceService.getWorkspaceAnalytics(workspaceId, req.user!.id, requestedView, { from, to });
  const payload = {
    workspace: analytics.workspace || null,
    stats: analytics.stats || null,
    hierarchy: analytics.hierarchy || [],
    members: analytics.members || [],
    tasks: analytics.tasks || [],
    announcements: analytics.announcements || [],
    currentRunningTimer: analytics.currentRunningTimer || null,
    timeTrackingSummary: analytics.timeTrackingSummary || null,
    stickyNote: analytics.stickyNote || null,
    recentActivity: analytics.recentActivity || [],
    performance: {
      user: analytics.performance?.user || null,
      team: analytics.performance?.team || []
    },
    view: analytics.view || null,
    permissions: analytics.permissions || null
  };

  await analyticsV2CacheService.set(cacheKey, payload, 20);

  res.status(200).json({
    success: true,
    message: "Workspace analytics v2 details retrieved successfully",
    data: payload
  });
});

const getWorkspaceAnalyticsV2CompletionTrend = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const requestedView = typeof req.query.view === "string" ? req.query.view : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const cacheKey = analyticsV2CacheService.buildSummaryKey({
    workspaceId,
    userId: `${req.user!.id}:trend`,
    view: requestedView,
    from,
    to
  });

  const cached = await analyticsV2CacheService.get(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Workspace analytics completion trend retrieved successfully",
      data: cached
    });
  }

  const Task = require("../models/Task");
  const List = require("../models/List");

  const activeLists = await List.find({ workspace: workspaceId, isDeleted: false }).select("_id").lean();
  const activeListIds = activeLists.map((l: any) => l._id);
  const createdAtRange = (() => {
    const range: any = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    return Object.keys(range).length ? range : null;
  })();

  const taskQuery: any = {
    workspace: workspaceId,
    list: { $in: activeListIds },
    isDeleted: false
  };
  if (createdAtRange) taskQuery.createdAt = createdAtRange;
  if (requestedView === "personal") {
    taskQuery.$or = [{ assignee: req.user!.id }, { createdBy: req.user!.id }];
  }

  const nowUtc = new Date();
  const buckets = [];
  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(nowUtc);
    weekEnd.setUTCDate(weekEnd.getUTCDate() - i * 7);
    weekEnd.setUTCHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weekStart.setUTCHours(0, 0, 0, 0);
    buckets.push({
      start: weekStart,
      end: weekEnd,
      label: `${weekStart.toISOString().slice(0, 10)} - ${weekEnd.toISOString().slice(0, 10)}`
    });
  }

  const data: any[] = await Task.aggregate([
    { $match: taskQuery },
    {
      $facet: buckets.reduce((acc: any, bucket: any, idx: number) => {
        acc[`created${idx}`] = [
          { $match: { createdAt: { $gte: bucket.start, $lte: bucket.end } } },
          { $count: "count" }
        ];
        acc[`completed${idx}`] = [
          { $match: { status: "done", completedAt: { $gte: bucket.start, $lte: bucket.end } } },
          { $count: "count" }
        ];
        return acc;
      }, {})
    }
  ]);

  const bucketRow = data[0] || {};
  const chartData = buckets.map((bucket: any, idx: number) => ({
    name: bucket.label,
    created: Number(bucketRow[`created${idx}`]?.[0]?.count || 0),
    completed: Number(bucketRow[`completed${idx}`]?.[0]?.count || 0),
  }));

  const payload = {
    chartData,
    summary: {
      totalCreated: chartData.reduce((acc: number, item: any) => acc + Number(item.created || 0), 0),
      totalCompleted: chartData.reduce((acc: number, item: any) => acc + Number(item.completed || 0), 0),
    }
  };

  await analyticsV2CacheService.set(cacheKey, payload, 45);

  res.status(200).json({
    success: true,
    message: "Workspace analytics completion trend retrieved successfully",
    data: payload
  });
});

const getWorkspaceAnalyticsV2TeamPerformance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const sort = typeof req.query.sort === "string" ? req.query.sort : "totalTasksFinished";
  const order = String(req.query.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const parsedPage = Number(req.query.page);
  const parsedLimit = Number(req.query.limit);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
  const rows = await performanceService.getTeamPerformance(workspaceId, { from, to });

  const sortable = [...(rows || [])];
  sortable.sort((a: any, b: any) => {
    const av = Number(a?.metrics?.[sort] ?? 0);
    const bv = Number(b?.metrics?.[sort] ?? 0);
    return order === "asc" ? av - bv : bv - av;
  });

  const total = sortable.length;
  const start = (page - 1) * limit;
  const items = sortable.slice(start, start + limit).map((entry: any) => ({
    user: {
      _id: entry?.user?._id,
      name: entry?.user?.name || "Unknown User",
      profilePicture: entry?.user?.profilePicture || entry?.user?.avatar || null
    },
    metrics: entry?.metrics || {}
  }));

  res.status(200).json({
    success: true,
    message: "Workspace analytics team performance retrieved successfully",
    data: { items, meta: { page, limit, total, hasMore: start + limit < total, sort, order } }
  });
});

const getWorkspaceAnalyticsV2Activity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const parsedPage = Number(req.query.page);
  const parsedLimit = Number(req.query.limit);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
  const skip = (page - 1) * limit;
  const rows = await activityService.getActivities({ workspaceId, userId: req.user!.id, limit, skip, startDate: from, endDate: to });

  const items = (rows || []).map((row: any) => ({
    _id: row._id,
    type: row.type,
    fieldChanged: row.fieldChanged || null,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    createdAt: row.createdAt,
    task: row.task ? { _id: row.task._id, title: row.task.title, status: row.task.status } : null,
    user: row.user
      ? { _id: row.user._id, name: row.user.name || "Unknown User", profilePicture: row.user.profilePicture || row.user.avatar || null }
      : null
  }));

  res.status(200).json({
    success: true,
    message: "Workspace analytics activity retrieved successfully",
    data: { items, meta: { page, limit, returned: items.length, hasMore: items.length === limit } }
  });
});

const getWorkspaceAnalyticsV2Announcements = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  const parsedPage = Number(req.query.page);
  const parsedLimit = Number(req.query.limit);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10;
  const skip = (page - 1) * limit;
  const rows = await Announcement.find({ workspace: workspaceId })
    .populate("author", "name profilePicture avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const total = await Announcement.countDocuments({ workspace: workspaceId });
  const items = rows.map((row: any) => ({
    _id: row._id,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.author
      ? { _id: row.author._id, name: row.author.name || "Unknown User", profilePicture: row.author.profilePicture || row.author.avatar || null }
      : null
  }));

  res.status(200).json({
    success: true,
    message: "Workspace analytics announcements retrieved successfully",
    data: { items, meta: { page, limit, total, hasMore: skip + limit < total } }
  });
});

// @desc    Update member custom role title
// @route   PATCH /api/workspaces/:workspaceId/members/:memberId/custom-role
// @access  Private (Workspace Owner Only)
const updateMemberCustomRole = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId, memberId } = req.params;
  let { customRoleTitle } = req.body;

  // Validate customRoleTitle
  if (customRoleTitle !== null && customRoleTitle !== undefined) {
    // Sanitize input with xss library
    customRoleTitle = xss(customRoleTitle);
    
    // Validate length (max 50 chars)
    if (customRoleTitle.length > 50) {
      throw new AppError("Custom role title cannot exceed 50 characters", 400);
    }
    
    // Trim whitespace
    customRoleTitle = customRoleTitle.trim();
    
    // If empty after trimming, set to null
    if (customRoleTitle === "") {
      customRoleTitle = null;
    }
  }

  // Check predefined role-title entitlement if adding a new one
  if (customRoleTitle) {
    const Workspace = require('../models/Workspace');
    
    // Get workspace to check current custom roles
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }
    
    // Get the member being updated
    const member = workspace.members.find((m: any) => m.user.toString() === memberId);
    if (!member) {
      throw new AppError('Member not found', 404);
    }
    
    // If member doesn't already have a role title, check feature + limit
    if (!member.customRoleTitle) {
      // Count current custom roles in workspace
      const currentCustomRoleCount = workspace.members.filter((m: any) => 
        m.customRoleTitle && m.customRoleTitle.trim() !== ''
      ).length;
      
      // Get owner's plan limits
      const ownerId = workspace.owner.toString();
      const User = require('../models/User');
      const Plan = require('../models/Plan');
      const PlanInheritanceService = require('../services/planInheritanceService').default;
      
      const owner = await User.findById(ownerId).populate('subscription.planId');
      if (!owner) {
        throw new AppError('Owner not found', 404);
      }
      
      // Get plan - either paid plan or free plan
      let planToUse = null;
      
      if (owner.subscription?.isPaid && owner.subscription.planId) {
        planToUse = owner.subscription.planId;
      } else {
        // Try to find free plan
        const freePlan = await Plan.findOne({ 
          name: { $regex: /free/i }, 
          isActive: true 
        });
        
        if (!freePlan) {
          // No plan found, default to 0 custom roles
          return res.status(400).json({
            success: false,
            code: 'CUSTOM_ROLE_LIMIT_REACHED',
            message: `Custom role limit reached (${currentCustomRoleCount}/0). Upgrade your plan to add custom roles.`,
            currentCount: currentCustomRoleCount,
            maxAllowed: 0
          });
        }
        
        planToUse = freePlan;
      }
      
      const resolvedFeatures = await PlanInheritanceService.resolveFeatures(planToUse);
      const canUsePredefinedRoles = resolvedFeatures.canUsePredefinedRoles !== false;
      const maxPredefinedRoles =
        resolvedFeatures.maxPredefinedRoles !== undefined && resolvedFeatures.maxPredefinedRoles !== null
          ? resolvedFeatures.maxPredefinedRoles
          : resolvedFeatures.maxCustomRoles ?? -1;

      if (!canUsePredefinedRoles) {
        return res.status(403).json({
          success: false,
          code: 'PREDEFINED_ROLES_NOT_AVAILABLE',
          message: 'Predefined role titles are not available in your current plan.'
        });
      }
      
      // Check if limit is reached
      if (maxPredefinedRoles !== -1 && currentCustomRoleCount >= maxPredefinedRoles) {
        return res.status(400).json({
          success: false,
          code: 'PREDEFINED_ROLE_LIMIT_REACHED',
          message: `Predefined role title limit reached (${currentCustomRoleCount}/${maxPredefinedRoles}). Upgrade your plan to add more.`,
          currentCount: currentCustomRoleCount,
          maxAllowed: maxPredefinedRoles
        });
      }
    }
  }

  // Update the member's custom role
  const updatedMember = await workspaceService.updateMemberCustomRole(
    workspaceId,
    memberId,
    customRoleTitle
  );

  res.status(200).json({
    success: true,
    message: "Member custom role updated successfully",
    data: updatedMember
  });
});

// @desc    Get workspace hierarchy (optimized single query)
// @route   GET /api/workspaces/:id/hierarchy
// @access  Private
const getWorkspaceHierarchy = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Get user role for permission check
  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(req.params.id).select('owner members');
  const isOwner = workspace.owner.toString() === req.user!.id;
  const member = workspace.members.find((m: any) => m.user.toString() === req.user!.id);
  const userRole = isOwner ? 'owner' : (member?.role || 'member');

  const hierarchy = await HierarchyService.getWorkspaceHierarchy(req.params.id, req.user!.id, userRole);



  res.status(200).json({
    success: true,
    message: "Workspace hierarchy retrieved successfully",
    data: hierarchy
  });
});

// @desc    Upload workspace logo
// @route   PATCH /api/workspaces/:id/logo
// @access  Private (Workspace Owner Only)
const uploadLogo = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: workspaceId } = req.params;
  const file = req.file;

  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  const uploadService = require("../services/uploadService");
  const result = await uploadService.uploadWorkspaceLogo({
    file,
    workspaceId: workspaceId,
    uploadedBy: req.user!.id
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

module.exports = {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceAnalytics,
  getWorkspaceAnalyticsV2,
  getWorkspaceAnalyticsV2Details,
  getWorkspaceAnalyticsV2CompletionTrend,
  getWorkspaceAnalyticsV2TeamPerformance,
  getWorkspaceAnalyticsV2Activity,
  getWorkspaceAnalyticsV2Announcements,
  updateMemberCustomRole,
  getWorkspaceHierarchy,
  uploadLogo
};

export {};
