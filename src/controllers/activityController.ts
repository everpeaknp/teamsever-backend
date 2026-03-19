const activityService = require("../services/activityService");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const Workspace = require("../models/Workspace");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Get activities with filters
 * GET /api/activities
 */
const getActivities = asyncHandler(async (req: any, res: any) => {
  console.log('[ActivityController] getActivities called', { query: req.query });
  
  const userId = req.user.id;
  const { workspaceId, spaceId, listId, limit, skip } = req.query;

  const activities = await activityService.getActivities({
    userId,
    workspaceId,
    spaceId,
    listId,
    limit: limit ? parseInt(limit) : 50,
    skip: skip ? parseInt(skip) : 0,
  });

  console.log('[ActivityController] Activities retrieved', { count: activities.length });

  res.status(200).json({
    success: true,
    count: activities.length,
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
    count: activities.length,
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
  const { limit, skip } = req.query;

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

  if (isOwner || isAdmin) {
    // Owners and admins see ALL activities
    
    [workspaceActivities, taskActivities] = await Promise.all([
      WorkspaceActivity.getWorkspaceActivity(workspaceId, {
        limit: limitNum,
        skip: skipNum,
      }),
      activityService.getActivities({
        userId,
        workspaceId,
        limit: limitNum,
        skip: skipNum,
      })
    ]);
  } else {
    // Regular members only see activities for spaces/lists they have access to
    
    const Space = require("../models/Space");
    const List = require("../models/List");
    const Task = require("../models/Task");
    const { ListMember } = require("../models/ListMember");

    // Get spaces where user is a member
    const userSpaces = await Space.find({
      workspace: workspaceId,
      isDeleted: false,
      'members.user': userId
    }).select('_id').lean();
    
    const userSpaceIds = userSpaces.map((s: any) => s._id.toString());

    // Get lists where user is a member (via ListMember)
    const userListMemberships = await ListMember.find({
      user: userId,
      workspace: workspaceId
    }).select('list space').lean();
    
    const userListIds = userListMemberships.map((lm: any) => lm.list.toString());
    const additionalSpaceIds = [...new Set(userListMemberships.map((lm: any) => lm.space.toString()))];
    
    // Combine space IDs (from space membership and list membership)
    const allAccessibleSpaceIds = [...new Set([...userSpaceIds, ...additionalSpaceIds])];

    // Get workspace activities filtered by accessible spaces/lists
    const allWorkspaceActivities = await WorkspaceActivity.find({
      workspace: workspaceId,
      isDeleted: false,
      $or: [
        { space: { $in: allAccessibleSpaceIds } }, // Activities in accessible spaces
        { list: { $in: userListIds } }, // Activities in accessible lists
        { type: 'member_joined' }, // Always show member joins
        { targetUser: userId } // Activities where user is the target (e.g., added to space/list)
      ]
    })
      .populate("user", "name email avatar")
      .populate("targetUser", "name email avatar")
      .populate("space", "name")
      .populate("list", "name")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();

    workspaceActivities = allWorkspaceActivities;

    // Get tasks in accessible lists
    const tasksInAccessibleLists = await Task.find({
      list: { $in: userListIds },
      isDeleted: false
    }).select('_id').lean();
    
    const taskIds = tasksInAccessibleLists.map((t: any) => t._id);

    // Get task activities for accessible tasks
    const Activity = require("../models/Activity");
    taskActivities = await Activity.find({
      task: { $in: taskIds },
      isDeleted: false
    })
      .populate("user", "name email avatar")
      .populate("task", "title status")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();
  }

  // Combine and sort by createdAt
  const allActivities = [...workspaceActivities, ...taskActivities].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Limit the combined results
  const limitedActivities = allActivities.slice(0, limitNum);

  res.status(200).json({
    success: true,
    count: limitedActivities.length,
    data: limitedActivities,
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
};

export {};
