"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socketService_1 = __importDefault(require("./socketService"));
const Notification = require("../models/Notification");
const DeviceToken = require("../models/DeviceToken");
const User = require("../models/User");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const { getMessaging, isFirebaseConfigured } = require("../config/firebase");
const logger = require("../utils/logger");
class EnhancedNotificationService {
    /**
     * Central notification pipeline
     * Creates notification, emits socket event if online, sends push if offline
     */
    async createNotification(options) {
        try {
            const { recipientId, type, title, body, data = {} } = options;
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
            }
            catch (error) {
                console.error("[Notification] Failed to log activity:", error);
            }
            // 3. Check if user is online
            const isOnline = socketService_1.default.isUserOnline(recipientId);
            if (isOnline) {
                // User is online - emit socket event to all devices
                console.log(`[Notification] User ${recipientId} is online, emitting to all devices`);
                socketService_1.default.emitToUser(recipientId, "notification:new", {
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
            }
            else {
                // User is offline - send push notification
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
        }
        catch (error) {
            console.error("[Notification] Failed to create notification:", error);
            throw error;
        }
    }
    /**
     * Notify task update
     */
    async notifyTaskUpdate(taskId, updatedBy, updateType, oldValue, newValue) {
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
            const recipients = [];
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
            let type = "TASK_UPDATE";
            let title = "Task Updated";
            let body = `${updaterName} updated task "${task.title}"`;
            if (updateType === "status") {
                type = "TASK_STATUS_CHANGED";
                title = "Task Status Changed";
                body = `${updaterName} changed status from "${oldValue}" to "${newValue}"`;
            }
            else if (updateType === "priority") {
                type = "TASK_PRIORITY_CHANGED";
                title = "Task Priority Changed";
                body = `${updaterName} changed priority from "${oldValue}" to "${newValue}"`;
            }
            else if (updateType === "assignee") {
                type = "TASK_ASSIGNED";
                title = "Task Assigned";
                body = `${updaterName} assigned you to "${task.title}"`;
            }
            // Send notification to each recipient
            for (const recipientId of uniqueRecipients) {
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify task update:", error);
            // Don't throw - we don't want to break task creation if notification fails
        }
    }
    /**
     * Notify comment added
     */
    async notifyCommentAdded(commentId, taskId, authorId, content, mentions = []) {
        try {
            const task = await Task.findById(taskId)
                .populate("assignee", "name email")
                .populate("createdBy", "name email")
                .lean();
            if (!task)
                return;
            const author = await User.findById(authorId).select("name").lean();
            const authorName = author?.name || "Someone";
            const contentPreview = content.length > 100 ? content.substring(0, 100) + "..." : content;
            // Notify task participants (excluding author)
            const recipients = [];
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify comment added:", error);
        }
    }
    /**
     * Notify comment updated
     */
    async notifyCommentUpdated(commentId, taskId, authorId) {
        try {
            const task = await Task.findById(taskId).lean();
            if (!task)
                return;
            const author = await User.findById(authorId).select("name").lean();
            const authorName = author?.name || "Someone";
            // Notify task participants (excluding author)
            const recipients = [];
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify comment updated:", error);
        }
    }
    /**
     * Notify comment deleted
     */
    async notifyCommentDeleted(commentId, taskId, deletedBy) {
        try {
            const task = await Task.findById(taskId).lean();
            if (!task)
                return;
            const deleter = await User.findById(deletedBy).select("name").lean();
            const deleterName = deleter?.name || "Someone";
            // Notify task participants (excluding deleter)
            const recipients = [];
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify comment deleted:", error);
        }
    }
    /**
     * Notify direct message
     */
    async notifyDirectMessage(conversationId, senderId, recipientId, content) {
        try {
            const sender = await User.findById(senderId).select("name").lean();
            const senderName = sender?.name || "Someone";
            const contentPreview = content.length > 100 ? content.substring(0, 100) + "..." : content;
            await this.createNotification({
                recipientId,
                type: "DM_NEW",
                title: `Message from ${senderName}`,
                body: contentPreview,
                data: {
                    resourceId: conversationId,
                    resourceType: "DirectMessage",
                    conversationId,
                    senderId,
                },
            });
        }
        catch (error) {
            console.error("[Notification] Failed to notify direct message:", error);
        }
    }
    /**
     * Notify file upload
     */
    async notifyFileUpload(attachmentId, uploadedBy, resourceType, resourceId, filename) {
        try {
            const uploader = await User.findById(uploadedBy).select("name").lean();
            const uploaderName = uploader?.name || "Someone";
            let recipients = [];
            let workspaceId;
            let taskId;
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify file upload:", error);
        }
    }
    /**
     * Notify subtask created
     */
    async notifySubtaskCreated(parentTaskId, subtaskId, createdBy) {
        try {
            const [parentTask, subtask] = await Promise.all([
                Task.findById(parentTaskId).populate("assignee", "name email").lean(),
                Task.findById(subtaskId).lean(),
            ]);
            if (!parentTask || !subtask)
                return;
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify subtask created:", error);
        }
    }
    /**
     * Notify dependency added
     */
    async notifyDependencyAdded(taskId, dependencyTaskId, addedBy, relationType) {
        try {
            const [task, dependencyTask] = await Promise.all([
                Task.findById(taskId).populate("assignee", "name email").lean(),
                Task.findById(dependencyTaskId).lean(),
            ]);
            if (!task || !dependencyTask)
                return;
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify dependency added:", error);
        }
    }
    /**
     * Notify dependency status changed
     */
    async notifyDependencyStatusChanged(taskId, dependencyTaskId, changedBy, newStatus) {
        try {
            const [task, dependencyTask] = await Promise.all([
                Task.findById(taskId).populate("assignee", "name email").lean(),
                Task.findById(dependencyTaskId).lean(),
            ]);
            if (!task || !dependencyTask)
                return;
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
        }
        catch (error) {
            console.error("[Notification] Failed to notify dependency status changed:", error);
        }
    }
    /**
     * Get user notifications with pagination
     */
    async getUserNotifications(userId, options = {}) {
        try {
            const page = options.page || 1;
            const limit = options.limit || 20;
            const skip = (page - 1) * limit;
            // Build query
            const query = { recipient: userId };
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
        }
        catch (error) {
            console.error("[Notification] Failed to get notifications:", error);
            throw error;
        }
    }
    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
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
        }
        catch (error) {
            console.error("[Notification] Failed to mark as read:", error);
            throw error;
        }
    }
    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        try {
            const result = await Notification.updateMany({
                recipient: userId,
                read: false,
            }, {
                $set: {
                    read: true,
                    readAt: new Date(),
                },
            });
            return result.modifiedCount;
        }
        catch (error) {
            console.error("[Notification] Failed to mark all as read:", error);
            throw error;
        }
    }
    /**
     * Get unread count
     */
    async getUnreadCount(userId) {
        try {
            const count = await Notification.countDocuments({
                recipient: userId,
                read: false,
            });
            return count;
        }
        catch (error) {
            console.error("[Notification] Failed to get unread count:", error);
            return 0;
        }
    }
    /**
     * Send push notification directly (internal method)
     */
    async sendPushNotification(userId, options) {
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
            const tokens = deviceTokens.map((dt) => dt.token);
            const message = {
                notification: {
                    title: options.title,
                    body: options.body,
                    ...(options.imageUrl && { imageUrl: options.imageUrl }),
                },
                data: options.data || {},
            };
            // Send to all tokens
            const results = await Promise.allSettled(tokens.map((token) => messaging.send({
                ...message,
                token,
            })));
            // Count successes
            const successCount = results.filter((r) => r.status === "fulfilled").length;
            console.log(`[Notification] Push sent to ${successCount}/${tokens.length} devices for user ${userId}`);
            // Remove invalid tokens
            const failedTokens = [];
            results.forEach((result, index) => {
                if (result.status === "rejected") {
                    const error = result.reason;
                    if (error.code === "messaging/invalid-registration-token" ||
                        error.code === "messaging/registration-token-not-registered") {
                        failedTokens.push(tokens[index]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                await DeviceToken.deleteMany({ token: { $in: failedTokens } });
                console.log(`[Notification] Removed ${failedTokens.length} invalid tokens`);
            }
            return successCount > 0;
        }
        catch (error) {
            console.error("[Notification] Failed to send push notification:", error);
            return false;
        }
    }
}
const enhancedNotificationService = new EnhancedNotificationService();
module.exports = enhancedNotificationService;
exports.default = enhancedNotificationService;
