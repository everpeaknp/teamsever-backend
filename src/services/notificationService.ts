const Notification = require("../models/Notification");
const DeviceToken = require("../models/DeviceToken");
const { getMessaging, isFirebaseConfigured } = require("../config/firebase");
const presenceManager = require("../socket/presence");
const logger = require("../utils/logger");
const { emitToUser } = require("../socket/events");
const enhancedNotificationService = require("./enhancedNotificationService");
const Announcement = require("../models/Announcement");
const Workspace = require("../models/Workspace");

const formatRoleName = (role: unknown): string | undefined => {
  if (typeof role !== "string" || !role.trim()) return undefined;
  return role
    .trim()
    .split(/[\s_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

interface NotificationData {
  resourceId?: string;
  resourceType?: string;
  workspaceId?: string;
  [key: string]: any;
}

interface CreateNotificationOptions {
  recipientId: string;
  type: "TASK_ASSIGNED" | "MENTION" | "INVITATION" | "INVITE_ACCEPTED" | "COMMENT_ADDED" | "SYSTEM";
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

class NotificationService {
  /**
   * Central notification pipeline
   * Creates notification, emits socket event if online, sends push if offline
   */
  async createNotification(options: CreateNotificationOptions): Promise<any> {
    return enhancedNotificationService.createNotification(options as any);
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
      workspaceId?: string;
    } = {}
  ): Promise<any> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Announcement records can be deleted independently of their recipient
      // notifications. Remove those orphaned notices before counting or paging
      // so old announcements cannot keep resurfacing in the dashboard.
      await this.removeOrphanedAnnouncementNotifications(
        userId,
        options.workspaceId
      );

      // Build query
      const query: any = { recipient: userId };
      if (options.unreadOnly) {
        query.read = false;
      }
      if (options.workspaceId) {
        query["data.workspaceId"] = options.workspaceId;
      }

      // Get total count
      const total = await Notification.countDocuments(query);

      // Get unread count
      const unreadQuery: any = {
        recipient: userId,
        read: false,
      };
      if (options.workspaceId) {
        unreadQuery["data.workspaceId"] = options.workspaceId;
      }
      const unreadCount = await Notification.countDocuments(unreadQuery);

      // Get notifications
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const announcementNotifications = notifications.filter(
        (notification: any) =>
          notification.type === "ANNOUNCEMENT_NEW" &&
          notification.data?.announcementId
      );
      if (announcementNotifications.length > 0) {
        const announcementIds = announcementNotifications.map(
          (notification: any) => notification.data.announcementId
        );
        const announcements = await Announcement.find({
          _id: { $in: announcementIds },
        })
          .select("author workspace subject body content")
          .lean();
        const announcementById = new Map<string, any>(
          announcements.map((announcement: any) => [
            String(announcement._id),
            announcement,
          ])
        );
        const workspaceIds = [
          ...new Set(
            announcements.map((announcement: any) =>
              String(announcement.workspace)
            )
          ),
        ];
        const workspaces = await Workspace.find({
          _id: { $in: workspaceIds },
        })
          .select("members")
          .populate("members.customRole", "name label")
          .lean();
        const workspaceById = new Map<string, any>(
          workspaces.map((workspace: any) => [String(workspace._id), workspace])
        );

        for (const notification of announcementNotifications) {
          const announcement = announcementById.get(
            String(notification.data.announcementId)
          );
          if (!announcement) continue;
          const workspace = workspaceById.get(String(announcement.workspace));
          const authorId = String(announcement.author);
          const authorMembership = workspace?.members?.find(
            (member: any) => String(member.user) === authorId
          );
          const roleName = formatRoleName(
            authorMembership?.customRoleTitle ||
              authorMembership?.customRole?.label ||
              authorMembership?.customRole?.name ||
              authorMembership?.role
          );
          const announcementSubject = String(
            announcement.subject || notification.data?.announcementSubject || ""
          ).trim();
          const announcementBody = String(
            announcement.body || announcement.content ||
              notification.data?.announcementBody ||
              notification.data?.announcementContent || ""
          ).trim();
          notification.data = {
            ...notification.data,
            ...(roleName ? { senderRole: roleName } : {}),
            ...(announcementSubject ? { announcementSubject } : {}),
            ...(announcementBody
              ? {
                  announcementBody,
                  // Keep legacy clients able to render the linked content.
                  announcementContent: announcementBody,
                }
              : {}),
          };
        }
      }

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

  /** Returns the newest active workspace announcement for the dashboard banner. */
  async getPendingWorkspaceNotice(
    userId: string,
    workspaceId: string
  ): Promise<any | null> {
    const notifications = await Notification.find({
      recipient: userId,
      type: "ANNOUNCEMENT_NEW",
      acknowledgedAt: null,
      "data.workspaceId": workspaceId,
      "data.announcementId": { $exists: true, $nin: [null, ""] },
    })
      .select("recipient type title body data read readAt acknowledgedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (notifications.length === 0) return null;

    const announcementIds = notifications.map((item: any) => item.data.announcementId);
    const announcements = await Announcement.find({
      _id: { $in: announcementIds },
      workspace: workspaceId,
    })
      .select("author workspace subject body content")
      .lean();
    const announcementById = new Map<string, any>(
      announcements.map((item: any) => [String(item._id), item])
    );
    const orphanedNotifications = notifications.filter(
      (item: any) => !announcementById.has(String(item.data.announcementId))
    );
    if (orphanedNotifications.length > 0) {
      await Notification.deleteMany({
        _id: { $in: orphanedNotifications.map((item: any) => item._id) },
        recipient: userId,
      });
    }

    const notification = notifications.find((item: any) =>
      announcementById.has(String(item.data.announcementId))
    );
    if (!notification) return null;

    const announcement = announcementById.get(String(notification.data.announcementId));
    const workspace = await Workspace.findById(workspaceId)
      .select("members")
      .populate("members.customRole", "name label")
      .lean();
    const authorId = String(announcement.author);
    const authorMembership = workspace?.members?.find(
      (member: any) => String(member.user) === authorId
    );
    const senderRole = formatRoleName(
      authorMembership?.customRoleTitle ||
        authorMembership?.customRole?.label ||
        authorMembership?.customRole?.name ||
        authorMembership?.role
    );
    const announcementSubject = String(announcement.subject || "").trim();
    const announcementBody = String(announcement.body || announcement.content || "").trim();

    return {
      ...notification,
      data: {
        ...notification.data,
        ...(senderRole ? { senderRole } : {}),
        ...(announcementSubject ? { announcementSubject } : {}),
        ...(announcementBody
          ? { announcementBody, announcementContent: announcementBody }
          : {}),
      },
    };
  }

  async deleteAnnouncementNotifications(announcementId: string): Promise<void> {
    await Notification.deleteMany({
      type: "ANNOUNCEMENT_NEW",
      "data.announcementId": announcementId,
    });
  }

  private async removeOrphanedAnnouncementNotifications(
    userId: string,
    workspaceId?: string
  ): Promise<void> {
    const query: any = {
      recipient: userId,
      type: "ANNOUNCEMENT_NEW",
      "data.announcementId": { $exists: true, $nin: [null, ""] },
    };
    if (workspaceId) query["data.workspaceId"] = workspaceId;

    const announcementIds: any[] = await Notification.distinct(
      "data.announcementId",
      query
    );
    if (announcementIds.length === 0) return;

    const existingAnnouncements = await Announcement.find({
      _id: { $in: announcementIds },
    })
      .select("_id")
      .lean();
    const existingIds = new Set(
      existingAnnouncements.map((announcement: any) =>
        String(announcement._id)
      )
    );
    const orphanedIds = announcementIds.filter(
      (announcementId) => !existingIds.has(String(announcementId))
    );
    if (orphanedIds.length === 0) return;

    await Notification.deleteMany({
      ...query,
      "data.announcementId": { $in: orphanedIds },
    });
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

  /** Permanently records that the recipient acknowledged a notice. */
  async acknowledgeNotification(notificationId: string, userId: string): Promise<any> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      const acknowledgedAt = notification.acknowledgedAt || new Date();

      const announcementId =
        notification.type === "ANNOUNCEMENT_NEW"
          ? notification.data?.announcementId
          : undefined;
      if (announcementId) {
        notification.acknowledgedAt = acknowledgedAt;
        notification.read = true;
        notification.readAt = acknowledgedAt;
        await notification.save();

        await Notification.updateMany(
          {
            recipient: userId,
            type: "ANNOUNCEMENT_NEW",
            "data.announcementId": announcementId,
          },
          {
            $set: {
              acknowledgedAt,
              read: true,
              readAt: acknowledgedAt,
            },
          }
        );
        return notification;
      }

      notification.acknowledgedAt = acknowledgedAt;
      if (!notification.read) {
        notification.read = true;
        notification.readAt = acknowledgedAt;
      }
      await notification.save();

      return notification;
    } catch (error) {
      console.error("[Notification] Failed to acknowledge notice:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string, workspaceId?: string): Promise<number> {
    try {
      const query: any = {
        recipient: userId,
        read: false,
      };
      if (workspaceId) {
        query["data.workspaceId"] = workspaceId;
      }

      const result = await Notification.updateMany(
        query,
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
  async getUnreadCount(userId: string, workspaceId?: string): Promise<number> {
    try {
      const query: any = {
        recipient: userId,
        read: false,
      };
      if (workspaceId) {
        query["data.workspaceId"] = workspaceId;
      }

      const count = await Notification.countDocuments(query);

      return count;
    } catch (error) {
      console.error("[Notification] Failed to get unread count:", error);
      return 0;
    }
  }

  /**
   * Check if user is online using presence system
   */
  private isUserOnline(userId: string, workspaceId?: string): boolean {
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
      const tokens = deviceTokens.map((dt: any) => dt.token);

      const rawData = options.data || {};
      // Firebase Admin SDK requires all data values to be strings
      const stringData: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawData)) {
        if (value !== null && value !== undefined) {
          stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
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

  /**
   * Register device token
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: "web" | "android" | "ios"
  ): Promise<void> {
    try {
      // Check if token already exists
      const existing = await DeviceToken.findOne({ token });

      if (existing) {
        // Refresh the owner and platform for tokens registered before the
        // client supplied platform metadata.
        let changed = false;
        if (existing.user.toString() !== userId) {
          existing.user = userId;
          changed = true;
        }
        if (existing.platform !== platform) {
          existing.platform = platform;
          changed = true;
        }
        if (changed) {
          await existing.save();
          console.log(`[Notification] Updated device token for user ${userId}`);
        }
      } else {
        // Create new token
        await DeviceToken.create({
          user: userId,
          token,
          platform,
        });
        console.log(`[Notification] Registered new device token for user ${userId}`);
      }
    } catch (error) {
      console.error("[Notification] Failed to register device token:", error);
      throw error;
    }
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      await DeviceToken.deleteOne({ token });
      console.log(`[Notification] Unregistered device token`);
    } catch (error) {
      console.error("[Notification] Failed to unregister device token:", error);
      throw error;
    }
  }

  /**
   * Get user's registered devices
   */
  async getUserDevices(userId: string): Promise<any[]> {
    try {
      const devices = await DeviceToken.find({ user: userId })
        .select("token platform createdAt")
        .lean();
      return devices;
    } catch (error) {
      console.error("[Notification] Failed to get user devices:", error);
      return [];
    }
  }
}

module.exports = new NotificationService();

export {};
