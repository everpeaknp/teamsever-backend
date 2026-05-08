const activityService = require("../services/activityService");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const Activity = require("../models/Activity");
const Folder = require("../models/Folder");
const List = require("../models/List");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Get activities with filters
 * GET /api/activities
 */
const getActivities = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { workspaceId, spaceId, listId, limit, skip } = req.query;

  // Basic access check if workspaceId is provided
  let isAdmin = false;
  let isOwner = false;
  if (workspaceId) {
    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
    if (!workspace) throw new AppError("Workspace not found", 404);
    
    isOwner = workspace.owner.toString() === userId;
    const member = workspace.members.find((m: any) => m.user.toString() === userId);
    if (!member && !isOwner) throw new AppError("Access denied", 403);
    isAdmin = member?.role === 'admin' || member?.role === 'owner' || isOwner;
  }

  // Only enforce personal-only filter when workspaceId is explicitly provided
  // and caller is not admin/owner. For listId-only queries, keep full list scope.
  const performedByFilter = workspaceId
    ? ((isAdmin || isOwner) ? undefined : userId)
    : undefined;

  const activities = await activityService.getActivities({
    userId,
    workspaceId,
    spaceId,
    listId,
    limit: limit ? parseInt(limit) : 50,
    skip: skip ? parseInt(skip) : 0,
    performedBy: performedByFilter
  });

  res.status(200).json({
    success: true,
    data: activities,
  });
});

/**
 * Create a comment on a task
 * POST /api/tasks/:taskId/comments
 */
const createComment = asyncHandler(async (req: any, res: any) => {
  const { taskId } = req.params;
  const { content, mentions } = req.body;
  const userId = req.user.id;

  const activity = await activityService.createComment({
    taskId,
    userId,
    content,
    mentions: mentions || [],
  });

  res.status(201).json({
    success: true,
    data: activity,
  });
});

/**
 * Get activity feed for a task (comments + updates)
 * GET /api/tasks/:taskId/activity
 */
const getTaskActivity = asyncHandler(async (req: any, res: any) => {
  const { taskId } = req.params;
  const userId = req.user.id;
  const { limit, skip, type } = req.query;

  const activities = await activityService.getTaskActivity(taskId, userId, {
    limit: limit ? parseInt(limit) : 50,
    skip: skip ? parseInt(skip) : 0,
    type, // 'comment' or 'update' or undefined for all
  });

  res.status(200).json({
    success: true,
    data: activities,
  });
});

/**
 * Update a comment
 * PUT /api/activities/:activityId
 */
const updateComment = asyncHandler(async (req: any, res: any) => {
  const { activityId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  const activity = await activityService.updateComment(activityId, userId, content);

  res.status(200).json({
    success: true,
    data: activity,
  });
});

/**
 * Delete a comment
 * DELETE /api/activities/:activityId
 */
const deleteComment = asyncHandler(async (req: any, res: any) => {
  const { activityId } = req.params;
  const userId = req.user.id;

  const result = await activityService.deleteComment(activityId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Add reaction to a comment
 * POST /api/activities/:activityId/reactions
 */
const addReaction = asyncHandler(async (req: any, res: any) => {
  const { activityId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.id;

  const activity = await activityService.addReaction(activityId, userId, emoji);

  res.status(200).json({
    success: true,
    data: activity,
  });
});

/**
 * Remove reaction from a comment
 * DELETE /api/activities/:activityId/reactions
 */
const removeReaction = asyncHandler(async (req: any, res: any) => {
  const { activityId } = req.params;
  const userId = req.user.id;

  const activity = await activityService.removeReaction(activityId, userId);

  res.status(200).json({
    success: true,
    data: activity,
  });
});

/**
 * Get user activity across workspace
 * GET /api/workspaces/:workspaceId/activity
 */
const getUserActivity = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;
  const { limit, skip, startDate, endDate } = req.query;

  // Build date filter
  const dateFilter: any = { isDeleted: false };
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt.$lte = end;
    }
  }

  // Verify user has access to workspace
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isDeleted: false
  });

  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  const hasAccess =
    workspace.owner.toString() === userId ||
    workspace.members.some((member: any) => member.user.toString() === userId);

  if (!hasAccess) {
    throw new AppError("You do not have access to this workspace", 403);
  }

  const limitNum = limit ? parseInt(limit) : 100;
  const skipNum = skip ? parseInt(skip) : 0;

  // Check if user is workspace owner or admin
  const isOwner = workspace.owner.toString() === userId;
  const workspaceMember = workspace.members.find((m: any) => m.user.toString() === userId);
  const isAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

  let workspaceActivities = [];
  let taskActivities = [];
  let timeActivities = [];

  if (isOwner || isAdmin) {
    // Owners and admins see ALL activities
    
    [workspaceActivities, taskActivities, timeActivities] = await Promise.all([
      WorkspaceActivity.find({ 
        workspace: workspaceId, 
        ...dateFilter 
      })
        .populate("user", "name email avatar")
        .populate("targetUser", "name email avatar")
        .populate("space", "name")
        .populate("list", "name")
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skipNum)
        .lean(),
      activityService.getActivities({
        userId,
        workspaceId,
        limit: limitNum,
        skip: skipNum,
        startDate,
        endDate
      }),
      TimeEntry.find({
        workspace: workspaceId,
        ...(startDate || endDate ? {
          startTime: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate ? { $lte: new Date(new Date(endDate).setHours(23,59,59,999)) } : {})
          }
        } : {})
      })
        .populate("user", "name email avatar")
        .sort({ startTime: -1 })
        .limit(limitNum)
        .skip(skipNum)
        .lean()
    ]);
    
    // Transform time entries into activity format
    timeActivities = timeActivities.map((entry: any) => ({
      _id: entry._id,
      type: entry.isRunning ? 'clock_in' : 'clock_out',
      createdAt: entry.isRunning ? entry.startTime : (entry.endTime || entry.updatedAt),
      user: entry.user,
      workspace: entry.workspace,
      description: entry.isRunning ? 'clocked in' : 'clocked out',
      metadata: {
        duration: entry.duration,
        timeEntryId: entry._id
      }
    }));
  } else {
    // Regular members only see their personal logs (actions they performed or where they are the target)
    [workspaceActivities, taskActivities, timeActivities] = await Promise.all([
      WorkspaceActivity.find({
        workspace: workspaceId,
        isDeleted: false,
        ...dateFilter,
        $or: [
          { user: userId },
          { targetUser: userId }
        ]
      })
        .populate("user", "name email avatar")
        .populate("targetUser", "name email avatar")
        .populate("space", "name")
        .populate("list", "name")
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skipNum)
        .lean(),
      activityService.getActivities({
        userId, // This service already filters by user ifuserId is provided? No, let's check
        workspaceId,
        limit: limitNum,
        skip: skipNum,
        startDate,
        endDate,
        performedBy: userId // We'll add this filter
      }),
      TimeEntry.find({
        user: userId, // Only their own timers
        workspace: workspaceId,
        isDeleted: false,
        ...(startDate || endDate ? {
          startTime: {
            ...(startDate ? { $gte: new Date(startDate) } : {}),
            ...(endDate ? { $lte: new Date(new Date(endDate).setHours(23,59,59,999)) } : {})
          }
        } : {})
      })
        .populate("user", "name email avatar")
        .sort({ startTime: -1 })
        .limit(limitNum)
        .skip(skipNum)
        .lean()
    ]);

    // Transform time entries into activity format
    timeActivities = timeActivities.map((entry: any) => ({
      _id: entry._id,
      type: entry.isRunning ? 'clock_in' : 'clock_out',
      createdAt: entry.isRunning ? entry.startTime : (entry.endTime || entry.updatedAt),
      user: entry.user,
      workspace: entry.workspace,
      description: entry.isRunning ? 'clocked in' : 'clocked out',
      metadata: {
        duration: entry.duration,
        timeEntryId: entry._id
      }
    }));
  }

  // Combine and sort by createdAt
  const allActivities = [...workspaceActivities, ...taskActivities, ...timeActivities].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Limit the combined results
  const limitedActivities = allActivities.slice(0, limitNum);

  res.status(200).json({
    success: true,
    data: limitedActivities,
  });
});

/**
 * Get GitHub commits for a specific space
 * GET /api/spaces/:spaceId/commits
 */
const getSpaceCommits = asyncHandler(async (req: any, res: any) => {
  const { spaceId } = req.params;
  const { limit = 50, skip = 0 } = req.query;

  const activities = await WorkspaceActivity.find({
    space: spaceId,
    type: "github_commit",
  })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  res.status(200).json({
    success: true,
    data: activities,
  });
});

/**
 * Get activity feed for a folder (aggregated from tasks in lists of the folder)
 * GET /api/folders/:folderId/activity
 */
const getFolderActivity = asyncHandler(async (req: any, res: any) => {
  const { folderId } = req.params;
  const userId = req.user.id;
  const { limit = 50, skip = 0 } = req.query;

  const folder = await Folder.findOne({ _id: folderId, isDeleted: false }).populate("spaceId", "workspace");
  if (!folder) {
    throw new AppError("Folder not found", 404);
  }

  const workspaceId = folder.spaceId?.workspace?.toString();
  if (!workspaceId) {
    throw new AppError("Workspace not found", 404);
  }

  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) {
    throw new AppError("Workspace not found", 404);
  }

  const isOwner = workspace.owner.toString() === userId;
  const member = workspace.members.find((m: any) => m.user.toString() === userId);
  const isMember = !!member;
  if (!isOwner && !isMember) {
    throw new AppError("Access denied", 403);
  }

  const folderLists = await List.find({
    folderId: folderId,
    isDeleted: false,
  }).select("_id");

  const listIds = folderLists.map((l: any) => l._id.toString());
  if (listIds.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  // Use the SAME service pipeline as list activity to ensure parity:
  // Activity + ActivityLog + synthesized task creation fallback.
  const perListActivities = await Promise.all(
    listIds.map((listId: string) =>
      activityService.getActivities({
        // Keep exact parity with list-level activity endpoint usage
        // (frontend list page calls /activities with listId only).
        listId,
        limit: parseInt(limit),
        skip: 0,
      })
    )
  );

  const flattened = perListActivities.flat();
  const activities = flattened
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

  res.status(200).json({
    success: true,
    data: activities,
  });
});

module.exports = {
  getActivities,
  createComment,
  getTaskActivity,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
  getUserActivity,
  getSpaceCommits,
  getFolderActivity,
};

export {};
