"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Notification = require("../models/Notification");
const DeviceToken = require("../models/DeviceToken");
const { getMessaging, isFirebaseConfigured } = require("../config/firebase");
const presenceManager = require("../socket/presence");
const logger = require("../utils/logger");
const { emitToUser } = require("../socket/events");
class NotificationService {
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
            const isOnline = this.isUserOnline(recipientId, data.workspaceId);
            if (isOnline) {
                // User is online - emit socket event
                console.log(`[Notification] User ${recipientId} is online, emitting socket event`);
                try {
                    emitToUser(recipientId, "notification:new", {
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
                catch (error) {
                    console.error("[Notification] Failed to emit socket event:", error);
                }
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
     * Check if user is online using presence system
     */
    isUserOnline(userId, workspaceId) {
        if (!workspaceId) {
            // Check if user is online in any workspace
            const userWorkspaces = presenceManager.getUserWorkspaces(userId);
            return userWorkspaces.length > 0;
        }
        // Check if user is online in specific workspace
        return presenceManager.isUserOnline(workspaceId, userId);
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
    /**
     * Register device token
     */
    async registerDeviceToken(userId, token, platform) {
        try {
            // Check if token already exists
            const existing = await DeviceToken.findOne({ token });
            if (existing) {
                // Update user if different
                if (existing.user.toString() !== userId) {
                    existing.user = userId;
                    existing.platform = platform;
                    await existing.save();
                    console.log(`[Notification] Updated device token for user ${userId}`);
                }
            }
            else {
                // Create new token
                await DeviceToken.create({
                    user: userId,
                    token,
                    platform,
                });
                console.log(`[Notification] Registered new device token for user ${userId}`);
            }
        }
        catch (error) {
            console.error("[Notification] Failed to register device token:", error);
            throw error;
        }
    }
    /**
     * Unregister device token
     */
    async unregisterDeviceToken(token) {
        try {
            await DeviceToken.deleteOne({ token });
            console.log(`[Notification] Unregistered device token`);
        }
        catch (error) {
            console.error("[Notification] Failed to unregister device token:", error);
            throw error;
        }
    }
    /**
     * Get user's registered devices
     */
    async getUserDevices(userId) {
        try {
            const devices = await DeviceToken.find({ user: userId })
                .select("token platform createdAt")
                .lean();
            return devices;
        }
        catch (error) {
            console.error("[Notification] Failed to get user devices:", error);
            return [];
        }
    }
}
module.exports = new NotificationService();
