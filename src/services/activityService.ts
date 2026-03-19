const Activity = require("../models/Activity");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const { emitTaskEvent } = require("../socket/events");
const enhancedNotificationService = require("./enhancedNotificationService");

interface CreateCommentData {
  taskId: string;
  userId: string;
  content: string;
  mentions?: string[];
}

interface CreateUpdateData {
  taskId: string;
  userId: string;
  fieldChanged: string;
  oldValue: any;
  newValue: any;
  isSystemGenerated?: boolean;
}

class ActivityService {
  /**
   * Create a comment on a task
   */
  async createComment(data: CreateCommentData) {
    const { taskId, userId, content, mentions = [] } = data;

    // Verify task exists
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false,
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Create comment activity
    const activity = new Activity({
      task: taskId,
      user: userId,
      workspace: task.workspace.toString(),
      type: "comment",
      content,
      mentions,
      isSystemGenerated: false,
    });

    const savedActivity = await activity.save();

    // Populate user info
    await savedActivity.populate("user", "name email avatar");
    await savedActivity.populate("mentions", "name email");

    // Emit real-time event
    try {
      emitTaskEvent(
        taskId,
        "comment_added",
        {
          activity: savedActivity,
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit comment event:", error);
    }

    // Send notifications to mentioned users
    if (mentions.length > 0) {
      try {
        await enhancedNotificationService.notifyMentions(
          taskId,
          userId,
          mentions,
          content
        );
      } catch (error) {
        console.error("[Activity] Failed to send mention notifications:", error);
      }
    }

    // Notify task assignee if they're not the commenter
    if (task.assignee && task.assignee.toString() !== userId) {
      try {
        await enhancedNotificationService.notifyTaskComment(
          taskId,
          userId,
          content
        );
      } catch (error) {
        console.error("[Activity] Failed to send comment notification:", error);
      }
    }

    return savedActivity;
  }

  /**
   * Create an update activity for field changes
   */
  async createUpdate(data: CreateUpdateData) {
    const {
      taskId,
      userId,
      fieldChanged,
      oldValue,
      newValue,
      isSystemGenerated = false,
    } = data;

    // Verify task exists
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false,
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Create update activity
    const activity = new Activity({
      task: taskId,
      user: userId,
      workspace: task.workspace.toString(),
      type: "update",
      fieldChanged,
      oldValue,
      newValue,
      isSystemGenerated,
    });

    await activity.save();

    // Populate user info
    const populatedActivity = await Activity.findById(activity._id)
      .populate("user", "name email avatar")
      .lean();

    if (!populatedActivity) {
      throw new AppError("Failed to create update activity", 500);
    }

    // Emit real-time event
    try {
      emitTaskEvent(
        taskId,
        "activity_added",
        {
          activity: populatedActivity,
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit update event:", error);
    }

    return populatedActivity;
  }

  /**
   * Get activity feed for a task (comments + updates)
   */
  async getTaskActivity(taskId: string, userId: string, options: any = {}) {
    // Verify task exists and user has access
    const task = await Task.findOne({
      _id: taskId,
      isDeleted: false,
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Get activity feed
    const activities = await Activity.getTaskActivity(taskId, {
      limit: options.limit || 50,
      skip: options.skip || 0,
      type: options.type, // Filter by 'comment' or 'update' if specified
    });

    return activities;
  }

  /**
   * Update a comment
   */
  async updateComment(activityId: string, userId: string, content: string) {
    const activity = await Activity.findOne({
      _id: activityId,
      type: "comment",
      isDeleted: false,
    });

    if (!activity) {
      throw new AppError("Comment not found", 404);
    }

    // Verify user is the comment author
    if (activity.user.toString() !== userId) {
      throw new AppError("You can only edit your own comments", 403);
    }

    activity.content = content;
    await activity.save();

    // Get fresh populated document
    const populatedActivity = await Activity.findById(activity._id)
      .populate("user", "name email avatar")
      .populate("mentions", "name email")
      .lean();

    // Emit real-time event
    try {
      emitTaskEvent(
        activity.task.toString(),
        "comment_updated",
        {
          activity: populatedActivity,
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit comment update event:", error);
    }

    return populatedActivity;
  }

  /**
   * Delete a comment
   */
  async deleteComment(activityId: string, userId: string) {
    const activity = await Activity.findOne({
      _id: activityId,
      type: "comment",
      isDeleted: false,
    });

    if (!activity) {
      throw new AppError("Comment not found", 404);
    }

    // Verify user is the comment author or workspace admin
    const workspace = await Workspace.findOne({
      _id: activity.workspace,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isAuthor = activity.user.toString() === userId;
    const member = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isAdmin = member && (member.role === "owner" || member.role === "admin");

    if (!isAuthor && !isAdmin) {
      throw new AppError("You do not have permission to delete this comment", 403);
    }

    // Soft delete
    await activity.softDelete(userId);

    // Emit real-time event
    try {
      emitTaskEvent(
        activity.task.toString(),
        "comment_deleted",
        {
          activityId: activity._id.toString(),
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit comment delete event:", error);
    }

    return { message: "Comment deleted successfully" };
  }

  /**
   * Add reaction to a comment
   */
  async addReaction(activityId: string, userId: string, emoji: string) {
    const activity = await Activity.findOne({
      _id: activityId,
      type: "comment",
      isDeleted: false,
    });

    if (!activity) {
      throw new AppError("Comment not found", 404);
    }

    // Verify user has access
    const workspace = await Workspace.findOne({
      _id: activity.workspace,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (m: any) => m.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this comment", 403);
    }

    // Add reaction
    await activity.addReaction(userId, emoji);

    // Get fresh populated document
    const populatedActivity = await Activity.findById(activity._id)
      .populate("user", "name email avatar")
      .populate("reactions.user", "name email")
      .lean();

    // Emit real-time event
    try {
      emitTaskEvent(
        activity.task.toString(),
        "comment_reaction",
        {
          activityId: activity._id.toString(),
          userId,
          emoji,
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit reaction event:", error);
    }

    return populatedActivity;
  }

  /**
   * Remove reaction from a comment
   */
  async removeReaction(activityId: string, userId: string) {
    const activity = await Activity.findOne({
      _id: activityId,
      type: "comment",
      isDeleted: false,
    });

    if (!activity) {
      throw new AppError("Comment not found", 404);
    }

    // Remove reaction
    await activity.removeReaction(userId);

    // Get fresh populated document
    const populatedActivity = await Activity.findById(activity._id)
      .populate("user", "name email avatar")
      .populate("reactions.user", "name email")
      .lean();

    // Emit real-time event
    try {
      emitTaskEvent(
        activity.task.toString(),
        "comment_reaction_removed",
        {
          activityId: activity._id.toString(),
          userId,
        },
        userId
      );
    } catch (error) {
      console.error("[Activity] Failed to emit reaction removal event:", error);
    }

    return populatedActivity;
  }

  /**
   * Get user activity across workspace
   */
  async getUserActivity(userId: string, workspaceId: string, options: any = {}) {
    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (m: any) => m.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Get user activity
    const activities = await Activity.getUserActivity(userId, workspaceId, {
      limit: options.limit || 50,
      skip: options.skip || 0,
    });

    return activities;
  }

  /**
   * Get activities with filters
   */
  async getActivities(params: {
    userId: string;
    workspaceId?: string;
    spaceId?: string;
    listId?: string;
    limit?: number;
    skip?: number;
  }) {
    const { userId, workspaceId, spaceId, listId, limit = 50, skip = 0 } = params;

    // If listId is provided, get all tasks in that list first
    if (listId) {
      const Task = require("../models/Task");
      const tasks = await Task.find({ list: listId, isDeleted: false }).select('_id');
      const taskIds = tasks.map((t: any) => t._id);
      
      // Get activities for these tasks
      const activities = await Activity.find({
        task: { $in: taskIds },
        isDeleted: false,
      })
        .populate("user", "name email avatar")
        .populate("task", "title status")
        .sort("-createdAt")
        .limit(limit)
        .skip(skip)
        .lean();

      return activities;
    }

    // Build query for other filters
    const query: any = { isDeleted: false };

    if (workspaceId) query.workspace = workspaceId;

    // Get activities
    const activities = await Activity.find(query)
      .populate("user", "name email avatar")
      .populate("task", "title status")
      .sort("-createdAt")
      .limit(limit)
      .skip(skip)
      .lean();

    return activities;
  }
}

module.exports = new ActivityService();

export {};
