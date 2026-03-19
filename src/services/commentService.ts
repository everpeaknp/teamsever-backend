const TaskComment = require("../models/TaskComment");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const socketService = require("./socketService").default;
const enhancedNotificationService = require("./enhancedNotificationService");
const { emitTaskEvent } = require("../socket/events");

interface CreateCommentData {
  userId: string;
  taskId: string;
  content: string;
  mentions?: string[];
}

interface GetCommentsOptions {
  page?: number;
  limit?: number;
}

class CommentService {
  /**
   * Validate user has access to task
   */
  private async validateTaskAccess(taskId: string, userId: string): Promise<any> {
    const task = await Task.findById(taskId).lean();

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    return { task, workspace };
  }

  /**
   * Create a new comment
   */
  async createComment(data: CreateCommentData): Promise<any> {
    const { userId, taskId, content, mentions = [] } = data;

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError("Comment content cannot be empty", 400);
    }

    if (content.length > 5000) {
      throw new AppError("Comment content too long (max 5000 characters)", 400);
    }

    // Validate task access
    const { task, workspace } = await this.validateTaskAccess(taskId, userId);

    // Create comment
    const comment = await TaskComment.create({
      task: taskId,
      author: userId,
      content: content.trim(),
      mentions,
    });

    // Populate author info
    await comment.populate("author", "name email");
    await comment.populate("mentions", "name email");

    // Log activity
    try {
      await logger.logActivity({
        userId,
        workspaceId: workspace._id.toString(),
        action: "CREATE",
        resourceType: "TaskComment",
        resourceId: comment._id.toString(),
        metadata: {
          taskId,
          contentLength: content.length,
          mentionsCount: mentions.length,
        },
      });
    } catch (error) {
      console.error("[Comment] Failed to log activity:", error);
    }

    // Emit real-time event to task room
    try {
      emitTaskEvent(
        taskId,
        "comment_added",
        {
          comment: {
            _id: comment._id,
            author: comment.author,
            content: comment.content,
            mentions: comment.mentions,
            edited: comment.edited,
            createdAt: comment.createdAt,
          },
        },
        userId
      );
    } catch (error) {
      console.error("[Comment] Failed to emit real-time event:", error);
    }

    // Send notifications using enhanced notification service
    // This handles both online (socket) and offline (FCM push) users automatically
    try {
      await enhancedNotificationService.notifyCommentAdded(
        comment._id.toString(),
        taskId,
        userId,
        content,
        mentions
      );
    } catch (error) {
      console.error("[Comment] Failed to send notifications:", error);
    }

    return comment;
  }

  /**
   * Get task comments with pagination
   */
  async getComments(
    taskId: string,
    userId: string,
    options: GetCommentsOptions = {}
  ): Promise<any> {
    // Validate task access
    await this.validateTaskAccess(taskId, userId);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    // Build query
    const query = { task: taskId };

    // Get total count
    const total = await TaskComment.countDocuments(query);

    // Get comments (sorted by createdAt ASC for chat-style)
    const comments = await TaskComment.find(query)
      .populate("author", "name email")
      .populate("mentions", "name email")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      comments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Edit a comment
   */
  async editComment(
    userId: string,
    commentId: string,
    content: string
  ): Promise<any> {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError("Comment content cannot be empty", 400);
    }

    if (content.length > 5000) {
      throw new AppError("Comment content too long (max 5000 characters)", 400);
    }

    // Find comment
    const comment = await TaskComment.findById(commentId);

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Validate task access
    const { task, workspace } = await this.validateTaskAccess(
      comment.task.toString(),
      userId
    );

    // Only author can edit
    if (comment.author.toString() !== userId) {
      throw new AppError("You can only edit your own comments", 403);
    }

    // Update comment
    const oldContent = comment.content;
    comment.content = content.trim();
    comment.edited = true;
    comment.editedAt = new Date();
    await comment.save();

    // Populate author info
    await comment.populate("author", "name email");
    await comment.populate("mentions", "name email");

    // Log audit
    try {
      await logger.logAudit({
        userId,
        workspaceId: workspace._id.toString(),
        resourceType: "TaskComment",
        resourceId: comment._id.toString(),
        oldValue: { content: oldContent },
        newValue: { content: comment.content },
      });
    } catch (error) {
      console.error("[Comment] Failed to log audit:", error);
    }

    // Emit real-time event
    try {
      emitTaskEvent(
        comment.task.toString(),
        "comment_updated",
        {
          comment: {
            _id: comment._id,
            content: comment.content,
            edited: comment.edited,
            editedAt: comment.editedAt,
          },
        },
        userId
      );
    } catch (error) {
      console.error("[Comment] Failed to emit real-time event:", error);
    }

    // Send notifications using enhanced notification service
    try {
      await enhancedNotificationService.notifyCommentUpdated(
        comment._id.toString(),
        comment.task.toString(),
        userId
      );
    } catch (error) {
      console.error("[Comment] Failed to send notifications:", error);
    }

    return comment;
  }

  /**
   * Delete a comment
   */
  async deleteComment(userId: string, commentId: string): Promise<any> {
    // Find comment
    const comment = await TaskComment.findById(commentId);

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Validate task access
    const { task, workspace } = await this.validateTaskAccess(
      comment.task.toString(),
      userId
    );

    // Check if user can delete (author or workspace admin)
    const isAuthor = comment.author.toString() === userId;
    const member = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isAdmin = member && (member.role === "owner" || member.role === "admin");

    if (!isAuthor && !isAdmin) {
      throw new AppError("You do not have permission to delete this comment", 403);
    }

    // Delete comment
    await TaskComment.deleteOne({ _id: commentId });

    // Log activity
    try {
      await logger.logActivity({
        userId,
        workspaceId: workspace._id.toString(),
        action: "DELETE",
        resourceType: "TaskComment",
        resourceId: commentId,
        metadata: {
          taskId: comment.task.toString(),
        },
      });
    } catch (error) {
      console.error("[Comment] Failed to log activity:", error);
    }

    // Emit real-time event
    try {
      emitTaskEvent(
        comment.task.toString(),
        "comment_deleted",
        {
          commentId: comment._id.toString(),
        },
        userId
      );
    } catch (error) {
      console.error("[Comment] Failed to emit real-time event:", error);
    }

    // Send notifications using enhanced notification service
    try {
      await enhancedNotificationService.notifyCommentDeleted(
        comment._id.toString(),
        comment.task.toString(),
        userId
      );
    } catch (error) {
      console.error("[Comment] Failed to send notifications:", error);
    }

    return { message: "Comment deleted successfully" };
  }

  /**
   * Get single comment by ID
   */
  async getCommentById(commentId: string, userId: string): Promise<any> {
    const comment = await TaskComment.findById(commentId)
      .populate("author", "name email")
      .populate("mentions", "name email")
      .lean();

    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Validate task access
    await this.validateTaskAccess(comment.task.toString(), userId);

    return comment;
  }
}

module.exports = new CommentService();

export {};
