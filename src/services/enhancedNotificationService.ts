import socketService from "./socketService";

const Notification = require("../models/Notification");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const Conversation = require("../models/Conversation");
const AppError = require("../utils/AppError");
const { getMessaging, isFirebaseConfigured } = require("../config/firebase");
const logger = require("../utils/logger");

type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_UPDATE"
  | "TASK_STATUS_CHANGED"
  | "TASK_PRIORITY_CHANGED"
  | "SUBTASK_CREATED"
  | "DEPENDENCY_ADDED"
  | "DEPENDENCY_STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_UPDATED"
  | "COMMENT_DELETED"
  | "MENTION"
  | "COMMENT_MENTION"
  | "DM_NEW"
  | "FILE_UPLOAD"
  | "INVITATION"
  | "SPACE_INVITATION"
  | "INVITE_ACCEPTED"
  | "ANNOUNCEMENT_NEW"
  | "GITHUB_COMMIT"
  | "SYSTEM";

interface NotificationData {
  resourceId?: string;
  resourceType?: string;
  workspaceId?: string;
  taskId?: string;
  commentId?: string;
  conversationId?: string;
  attachmentId?: string;
  [key: string]: any;
}

interface CreateNotificationOptions {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
}

interface PushNotificationData {
  type?: string;
  workspaceId?: string;
  taskId?: string;
  messageId?: string;
  [key: string]: any;
}

interface SendPushOptions {
  title: string;
  body: string;
  data?: PushNotificationData;
  imageUrl?: string;
}

class EnhancedNotificationService {
  private async isNotificationEnabledForUser(recipientId: string, type: NotificationType): Promise<boolean> {
    const user = await User.findById(recipientId).select("notificationPreferences").lean();
    const prefs = user?.notificationPreferences;
    if (!prefs) return true;

    switch (type) {
      case "GITHUB_COMMIT":
        return prefs.githubCommits !== false;
      case "TASK_ASSIGNED":
        return prefs.taskAssigned !== false;
      case "TASK_STATUS_CHANGED":
        return prefs.taskStatusChange !== false;
      case "TASK_UPDATE":
      case "TASK_PRIORITY_CHANGED":
      case "SUBTASK_CREATED":
      case "DEPENDENCY_ADDED":
      case "DEPENDENCY_STATUS_CHANGED":
      case "FILE_UPLOAD":
        return prefs.taskUpdates !== false;
      case "DM_NEW":
        return prefs.messages !== false;
      case "COMMENT_MENTION":
      case "MENTION":
        return prefs.mentions !== false;
      case "COMMENT_ADDED":
      case "COMMENT_UPDATED":
      case "COMMENT_DELETED":
        return prefs.comments !== false;
      case "INVITATION":
      case "SPACE_INVITATION":
      case "INVITE_ACCEPTED":
      case "ANNOUNCEMENT_NEW":
      case "SYSTEM":
        return prefs.notices !== false;
      default:
        return true;
    }
  }

  /**
   * Central notification pipeline
   * Creates notification, emits socket event if online, sends push if offline
   */
  async createNotification(options: CreateNotificationOptions): Promise<any> {
    try {
      const { recipientId, type, title, body, data = {} } = options;
      const notificationsEnabled = await this.isNotificationEnabledForUser(recipientId, type);
      if (!notificationsEnabled) {
        return null;
      }

      // 1. Save notification to database
      const notification = await Notification.create({
        recipient: recipientId,
        type,
        title,
        body,
        data,
      });

      // Populate recipient for response
      await notification.populate("recipient", "name email");

      // 2. Log notification creation
      try {
        if (data.workspaceId) {
          await logger.logActivity({
            userId: recipientId,
            workspaceId: data.workspaceId,
            action: "CREATE",
            resourceType: "Notification",
            resourceId: notification._id.toString(),
            metadata: {
              type,
              title,
            },
          });
        }
      } catch (error) {
        console.error("[Notification] Failed to log activity:", error);
      }

      // 3. Emit socket event for real-time UI update
      // We always emit to the user's personal room. This ensures that any open tab 
      // receives the notification instantly.
      socketService.emitToUser(recipientId, "notification:new", {
        notification: {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          read: notification.read,
          createdAt: notification.createdAt,
        },
      });

      // 4. Send push notification if user is offline (or as redundancy)
      const isOnline = socketService.isUserOnline(recipientId);
      if (!isOnline) {
        console.log(`[Notification] User ${recipientId} is offline, sending push`);
        await this.sendPushNotification(recipientId, {
          title,
          body,
          data: {
            type,
            notificationId: notification._id.toString(),
            ...data,
          },
        });
      }

      return notification;
    } catch (error) {
      console.error("[Notification] Failed to create notification:", error);
      throw error;
    }
  }

  /**
   * Notify new announcement to all workspace members
   */
  async notifyAnnouncementCreated(
    announcementId: string,
    workspaceId: string,
    authorId: string,
    content: string
  ): Promise<void> {
    try {
      const workspace = await Workspace.findById(workspaceId).lean();
      if (!workspace) return;

      const author = await User.findById(authorId).select("name").lean();
      const authorName = author?.name || "Someone";
      const contentPreview = content.length > 100 ? content.substring(0, 100) + "..." : content;

      // Notify all members except author
      const recipients = workspace.members
        .map((m: any) => m.user.toString())
        .filter((id: string) => id !== authorId);

      for (const recipientId of recipients) {
        // Check preferences
        const user = await User.findById(recipientId).select("notificationPreferences").lean();
        if (user?.notificationPreferences?.notices === false) continue;

        await this.createNotification({
          recipientId,
          type: "ANNOUNCEMENT_NEW",
          title: `New Announcement in ${workspace.name}`,
          body: `${authorName}: ${contentPreview}`,
          data: {
            resourceId: announcementId,
            resourceType: "Announcement",
            workspaceId,
            announcementId,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify announcement created:", error);
    }
  }
  
  /**
   * Notify members of a space about a new GitHub commit
   */
  async notifyGithubCommit(
    spaceId: string,
    repoName: string,
    commitMessage: string,
    authorName: string,
    url?: string
  ): Promise<void> {
    try {
      const Space = require("../models/Space");
      const space = await Space.findById(spaceId).populate("members.user").lean();
      if (!space) return;

      const workspace = await Workspace.findById(space.workspace).lean();
      if (!workspace) return;

      // Identify all members of the space + workspace owners/admins
      const spaceMemberIds = space.members.map((m: any) => {
        const userId = m.user?._id || m.user;
        return userId?.toString();
      }).filter(Boolean);

      const workspaceAdminIds = workspace.members
        .filter((m: any) => m.role === "admin" || m.role === "owner")
        .map((m: any) => {
          const userId = m.user?._id || m.user;
          return userId?.toString();
        }).filter(Boolean);

      const ownerId = (workspace.owner?._id || workspace.owner).toString();

      const allRecipientIds = [...new Set([...spaceMemberIds, ...workspaceAdminIds, ownerId])];
      
      console.log(`[EnhancedNotification] GitHub commit notification for space ${space.name} targeting:`, allRecipientIds);
      
      const title = `New Commit in ${space.name}`;
      const body = `${authorName} pushed to ${repoName}: "${commitMessage}"`;

      for (const recipientId of allRecipientIds) {
        // Fetch user to check preferences
        const user = await User.findById(recipientId).select("notificationPreferences").lean();
        
        // Skip if user has disabled commit notifications (defaults to true if preference is missing)
        if (user?.notificationPreferences?.githubCommits === false) {
          continue;
        }

        await this.createNotification({
          recipientId,
          type: "GITHUB_COMMIT",
          title,
          body,
          data: {
            resourceId: spaceId,
            resourceType: "Space",
            workspaceId: space.workspace.toString(),
            spaceId,
            repoName,
            url,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify github commit:", error);
    }
  }

  /**
   * Notify task update
   */
  async notifyTaskUpdate(
    taskId: string,
    updatedBy: string,
    updateType: "status" | "priority" | "assignee" | "general",
    oldValue: any,
    newValue: any
  ): Promise<void> {
    try {
      console.log(`[EnhancedNotification] notifyTaskUpdate called for task ${taskId}`);
      
      const task = await Task.findById(taskId)
        .populate("assignee", "name email")
        .populate("createdBy", "name email")
        .lean();

      if (!task) {
        console.log(`[EnhancedNotification] Task ${taskId} not found`);
        return;
      }

      console.log(`[EnhancedNotification] Task found:`, {
        _id: task._id,
        title: task.title,
        assignee: task.assignee,
        createdBy: task.createdBy,
      });

      const updater = await User.findById(updatedBy).select("name").lean();
      const updaterName = updater?.name || "Someone";

      // Determine recipients (assignee and creator, excluding updater)
      const recipients: string[] = [];
      
      // Handle assignee (could be populated or just ObjectId)
      if (task.assignee) {
        const assigneeId = task.assignee._id ? task.assignee._id.toString() : task.assignee.toString();
        if (assigneeId !== updatedBy) {
          recipients.push(assigneeId);
        }
      }
      
      // Handle createdBy (could be populated or just ObjectId)
      if (task.createdBy) {
        const creatorId = task.createdBy._id ? task.createdBy._id.toString() : task.createdBy.toString();
        if (creatorId !== updatedBy) {
          recipients.push(creatorId);
        }
      }

      // Remove duplicates
      const uniqueRecipients = [...new Set(recipients)];
      console.log(`[EnhancedNotification] Recipients:`, uniqueRecipients);

      // Determine notification type and message
      let type: NotificationType = "TASK_UPDATE";
      let title = "Task Updated";
      let body = `${updaterName} updated task "${task.title}"`;

      if (updateType === "status") {
        type = "TASK_STATUS_CHANGED";
        title = "Task Status Changed";
        body = `${updaterName} changed status from "${oldValue}" to "${newValue}"`;
      } else if (updateType === "priority") {
        type = "TASK_PRIORITY_CHANGED";
        title = "Task Priority Changed";
        body = `${updaterName} changed priority from "${oldValue}" to "${newValue}"`;
      } else if (updateType === "assignee") {
        type = "TASK_ASSIGNED";
        title = "Task Assigned";
        body = `${updaterName} assigned you to "${task.title}"`;
      }

      // Send notification to each recipient
      for (const recipientId of uniqueRecipients) {
        // Check preferences
        const user = await User.findById(recipientId).select("notificationPreferences").lean();
        
        if (updateType === "status") {
          if (user?.notificationPreferences?.taskStatusChange === false) continue;
        } else if (updateType === "assignee") {
          if (user?.notificationPreferences?.taskAssigned === false) continue;
        } else {
          if (user?.notificationPreferences?.taskUpdates === false) continue;
        }

        await this.createNotification({
          recipientId,
          type,
          title,
          body,
          data: {
            resourceId: taskId,
            resourceType: "Task",
            workspaceId: task.workspace.toString(),
            taskId,
            oldValue,
            newValue,
          },
        });
      }
      
      console.log(`[EnhancedNotification] Notifications sent successfully`);
    } catch (error) {
      console.error("[Notification] Failed to notify task update:", error);
      // Don't throw - we don't want to break task creation if notification fails
    }
  }

  /**
   * Notify comment added
   */
  async notifyCommentAdded(
    commentId: string,
    taskId: string,
    authorId: string,
    content: string,
    mentions: string[] = []
  ): Promise<void> {
    try {
      const task = await Task.findById(taskId)
        .populate("assignee", "name email")
        .populate("createdBy", "name email")
        .lean();

      if (!task) return;

      const author = await User.findById(authorId).select("name").lean();
      const authorName = author?.name || "Someone";
      const contentPreview = content.length > 100 ? content.substring(0, 100) + "..." : content;

      // Notify task participants (excluding author)
      const recipients: string[] = [];
      if (task.assignee && task.assignee._id.toString() !== authorId) {
        recipients.push(task.assignee._id.toString());
      }
      if (task.createdBy && task.createdBy._id.toString() !== authorId) {
        recipients.push(task.createdBy._id.toString());
      }

      // Remove duplicates
      const uniqueRecipients = [...new Set(recipients)];

      // Notify participants
      for (const recipientId of uniqueRecipients) {
        // Check preferences
        const user = await User.findById(recipientId).select("notificationPreferences").lean();
        if (user?.notificationPreferences?.comments === false) continue;

        await this.createNotification({
          recipientId,
          type: "COMMENT_ADDED",
          title: "New Comment",
          body: `${authorName}: ${contentPreview}`,
          data: {
            resourceId: commentId,
            resourceType: "TaskComment",
            workspaceId: task.workspace.toString(),
            taskId,
            commentId,
          },
        });
      }

      // Notify mentioned users
      for (const mentionedUserId of mentions) {
        if (mentionedUserId !== authorId) {
          // Check preferences
          const user = await User.findById(mentionedUserId).select("notificationPreferences").lean();
          if (user?.notificationPreferences?.mentions === false) continue;

          await this.createNotification({
            recipientId: mentionedUserId,
            type: "COMMENT_MENTION",
            title: "You were mentioned",
            body: `${authorName} mentioned you: ${contentPreview}`,
            data: {
              resourceId: commentId,
              resourceType: "TaskComment",
              workspaceId: task.workspace.toString(),
              taskId,
              commentId,
            },
          });
        }
      }
    } catch (error) {
      console.error("[Notification] Failed to notify comment added:", error);
    }
  }

  /**
   * Notify comment updated
   */
  async notifyCommentUpdated(
    commentId: string,
    taskId: string,
    authorId: string
  ): Promise<void> {
    try {
      const task = await Task.findById(taskId).lean();
      if (!task) return;

      const author = await User.findById(authorId).select("name").lean();
      const authorName = author?.name || "Someone";

      // Notify task participants (excluding author)
      const recipients: string[] = [];
      if (task.assignee && task.assignee.toString() !== authorId) {
        recipients.push(task.assignee.toString());
      }
      if (task.createdBy && task.createdBy.toString() !== authorId) {
        recipients.push(task.createdBy.toString());
      }

      const uniqueRecipients = [...new Set(recipients)];

      for (const recipientId of uniqueRecipients) {
        await this.createNotification({
          recipientId,
          type: "COMMENT_UPDATED",
          title: "Comment Updated",
          body: `${authorName} updated their comment`,
          data: {
            resourceId: commentId,
            resourceType: "TaskComment",
            workspaceId: task.workspace.toString(),
            taskId,
            commentId,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify comment updated:", error);
    }
  }

  /**
   * Notify comment deleted
   */
  async notifyCommentDeleted(
    commentId: string,
    taskId: string,
    deletedBy: string
  ): Promise<void> {
    try {
      const task = await Task.findById(taskId).lean();
      if (!task) return;

      const deleter = await User.findById(deletedBy).select("name").lean();
      const deleterName = deleter?.name || "Someone";

      // Notify task participants (excluding deleter)
      const recipients: string[] = [];
      if (task.assignee && task.assignee.toString() !== deletedBy) {
        recipients.push(task.assignee.toString());
      }
      if (task.createdBy && task.createdBy.toString() !== deletedBy) {
        recipients.push(task.createdBy.toString());
      }

      const uniqueRecipients = [...new Set(recipients)];

      for (const recipientId of uniqueRecipients) {
        await this.createNotification({
          recipientId,
          type: "COMMENT_DELETED",
          title: "Comment Deleted",
          body: `${deleterName} deleted a comment`,
          data: {
            resourceId: commentId,
            resourceType: "TaskComment",
            workspaceId: task.workspace.toString(),
            taskId,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify comment deleted:", error);
    }
  }

  /**
   * Notify direct message
   */
  async notifyDirectMessage(
    conversationId: string,
    senderId: string,
    recipientId: string,
    content: string,
    recipientPreferences?: any
  ): Promise<void> {
    try {
      const sender = await User.findById(senderId).select("name").lean();
      const senderName = sender?.name || "Someone";
      const contentPreview = content.length > 100 ? content.substring(0, 100) + "..." : content;
      const conversation = await Conversation.findById(conversationId).select("workspace").lean();
      const workspaceId =
        typeof conversation?.workspace === "string"
          ? conversation.workspace
          : conversation?.workspace?.toString?.();

      let prefs = recipientPreferences;
      if (!prefs) {
        const user = await User.findById(recipientId).select("notificationPreferences").lean();
        prefs = user?.notificationPreferences;
      }

      if (prefs?.messages === false) return;

      const mutedUsers = Array.isArray(prefs?.mutedUsers) ? prefs.mutedUsers : [];
      if (mutedUsers.includes(senderId)) return;

      await this.createNotification({
        recipientId,
        type: "DM_NEW",
        title: senderName,
        body: contentPreview,
        data: {
          resourceId: conversationId,
          resourceType: "DirectMessage",
          conversationId,
          senderId,
          senderName,
          workspaceId,
        },
      });
    } catch (error) {
      console.error("[Notification] Failed to notify direct message:", error);
    }
  }

  /**
   * Notify file upload
   */
  async notifyFileUpload(
    attachmentId: string,
    uploadedBy: string,
    resourceType: "Task" | "Comment" | "DirectMessage",
    resourceId: string,
    filename: string
  ): Promise<void> {
    try {
      const uploader = await User.findById(uploadedBy).select("name").lean();
      const uploaderName = uploader?.name || "Someone";

      let recipients: string[] = [];
      let workspaceId: string | undefined;
      let taskId: string | undefined;

      // Determine recipients based on resource type
      if (resourceType === "Task") {
        const task = await Task.findById(resourceId).lean();
        if (task) {
          workspaceId = task.workspace.toString();
          taskId = resourceId;
          if (task.assignee && task.assignee.toString() !== uploadedBy) {
            recipients.push(task.assignee.toString());
          }
          if (task.createdBy && task.createdBy.toString() !== uploadedBy) {
            recipients.push(task.createdBy.toString());
          }
        }
      }
      // Add more resource types as needed

      const uniqueRecipients = [...new Set(recipients)];

      for (const recipientId of uniqueRecipients) {
        await this.createNotification({
          recipientId,
          type: "FILE_UPLOAD",
          title: "File Uploaded",
          body: `${uploaderName} uploaded "${filename}"`,
          data: {
            resourceId: attachmentId,
            resourceType: "Attachment",
            workspaceId,
            taskId,
            attachmentId,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify file upload:", error);
    }
  }

  /**
   * Notify subtask created
   */
  async notifySubtaskCreated(
    parentTaskId: string,
    subtaskId: string,
    createdBy: string
  ): Promise<void> {
    try {
      const [parentTask, subtask] = await Promise.all([
        Task.findById(parentTaskId).populate("assignee", "name email").lean(),
        Task.findById(subtaskId).lean(),
      ]);

      if (!parentTask || !subtask) return;

      const creator = await User.findById(createdBy).select("name").lean();
      const creatorName = creator?.name || "Someone";

      // Notify parent task assignee
      if (parentTask.assignee && parentTask.assignee._id.toString() !== createdBy) {
        await this.createNotification({
          recipientId: parentTask.assignee._id.toString(),
          type: "SUBTASK_CREATED",
          title: "Subtask Created",
          body: `${creatorName} created subtask "${subtask.title}" under "${parentTask.title}"`,
          data: {
            resourceId: subtaskId,
            resourceType: "Task",
            workspaceId: parentTask.workspace.toString(),
            taskId: parentTaskId,
            subtaskId,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify subtask created:", error);
    }
  }

  /**
   * Notify dependency added
   */
  async notifyDependencyAdded(
    taskId: string,
    dependencyTaskId: string,
    addedBy: string,
    relationType: "blocker" | "dependent"
  ): Promise<void> {
    try {
      const [task, dependencyTask] = await Promise.all([
        Task.findById(taskId).populate("assignee", "name email").lean(),
        Task.findById(dependencyTaskId).lean(),
      ]);

      if (!task || !dependencyTask) return;

      const adder = await User.findById(addedBy).select("name").lean();
      const adderName = adder?.name || "Someone";

      if (task.assignee && task.assignee._id.toString() !== addedBy) {
        const title = relationType === "blocker" 
          ? "Dependency Added" 
          : "Task Now Blocking";
        
        const body = relationType === "blocker"
          ? `${adderName} added "${dependencyTask.title}" as a blocker for "${task.title}"`
          : `${adderName} made "${task.title}" a blocker for "${dependencyTask.title}"`;

        await this.createNotification({
          recipientId: task.assignee._id.toString(),
          type: "DEPENDENCY_ADDED",
          title,
          body,
          data: {
            resourceId: taskId,
            resourceType: "Task",
            workspaceId: task.workspace.toString(),
            taskId,
            dependencyTaskId,
            relationType,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify dependency added:", error);
    }
  }

  /**
   * Notify dependency status changed
   */
  async notifyDependencyStatusChanged(
    taskId: string,
    dependencyTaskId: string,
    changedBy: string,
    newStatus: string
  ): Promise<void> {
    try {
      const [task, dependencyTask] = await Promise.all([
        Task.findById(taskId).populate("assignee", "name email").lean(),
        Task.findById(dependencyTaskId).lean(),
      ]);

      if (!task || !dependencyTask) return;

      const changer = await User.findById(changedBy).select("name").lean();
      const changerName = changer?.name || "Someone";

      if (task.assignee && task.assignee._id.toString() !== changedBy) {
        await this.createNotification({
          recipientId: task.assignee._id.toString(),
          type: "DEPENDENCY_STATUS_CHANGED",
          title: "Blocker Status Changed",
          body: `${changerName} changed "${dependencyTask.title}" status to "${newStatus}"`,
          data: {
            resourceId: taskId,
            resourceType: "Task",
            workspaceId: task.workspace.toString(),
            taskId,
            dependencyTaskId,
            newStatus,
          },
        });
      }
    } catch (error) {
      console.error("[Notification] Failed to notify dependency status changed:", error);
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {}
  ): Promise<any> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { recipient: userId };
      if (options.unreadOnly) {
        query.read = false;
      }

      // Get total count
      const total = await Notification.countDocuments(query);

      // Get unread count
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        read: false,
      });

      // Get notifications
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return {
        notifications,
        pagination: {
          total,
          unreadCount,
          page,
          pages: Math.ceil(total / limit),
          limit,
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      console.error("[Notification] Failed to get notifications:", error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      if (notification.read) {
        return notification;
      }

      notification.read = true;
      notification.readAt = new Date();
      await notification.save();

      return notification;
    } catch (error) {
      console.error("[Notification] Failed to mark as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error("[Notification] Failed to mark all as read:", error);
      throw error;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        read: false,
      });

      return count;
    } catch (error) {
      console.error("[Notification] Failed to get unread count:", error);
      return 0;
    }
  }

  /**
   * Send push notification directly (internal method)
   */
  private async sendPushNotification(
    userId: string,
    options: SendPushOptions
  ): Promise<boolean> {
    try {
      // Check if Firebase is configured
      if (!isFirebaseConfigured()) {
        console.log("[Notification] Firebase not configured, skipping push");
        return false;
      }

      // Get user's device tokens
      const deviceTokens = await DeviceToken.find({ user: userId }).lean();

      if (deviceTokens.length === 0) {
        console.log(`[Notification] No device tokens found for user ${userId}`);
        return false;
      }

      // Send push notification directly via FCM
      const messaging = getMessaging();
      if (!messaging) {
        console.log("[Notification] Messaging client unavailable, skipping push");
        return false;
      }
      const tokens = deviceTokens.map((dt: any) => dt.token);

      const rawData = options.data || {};
      // Firebase Admin requires all data values to be strings.
      const stringData: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawData)) {
        if (value !== null && value !== undefined) {
          stringData[key] = typeof value === "string" ? value : JSON.stringify(value);
        }
      }

      const message = {
        notification: {
          title: options.title,
          body: options.body,
          ...(options.imageUrl && { imageUrl: options.imageUrl }),
        },
        data: stringData,
      };

      // Send to all tokens
      const results = await Promise.allSettled(
        tokens.map((token: string) =>
          messaging.send({
            ...message,
            token,
          })
        )
      );

      // Count successes
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      console.log(`[Notification] Push sent to ${successCount}/${tokens.length} devices for user ${userId}`);

      // Remove invalid tokens
      const failedTokens: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const error = result.reason;
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
            failedTokens.push(tokens[index]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await DeviceToken.deleteMany({ token: { $in: failedTokens } });
        console.log(`[Notification] Removed ${failedTokens.length} invalid tokens`);
      }

      return successCount > 0;
    } catch (error) {
      console.error("[Notification] Failed to send push notification:", error);
      return false;
    }
  }
}

const enhancedNotificationService = new EnhancedNotificationService();

module.exports = enhancedNotificationService;
export default enhancedNotificationService;
