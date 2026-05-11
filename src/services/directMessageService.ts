const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const enhancedNotificationService = require("./enhancedNotificationService");
const { emitToUser } = require("../socket/events");

interface SendMessageData {
  senderId: string;
  targetUserId: string;
  content: string;
  workspaceId: string;
}

interface GetMessagesOptions {
  workspaceId: string;
  page?: number;
  limit?: number;
}

interface GetConversationsOptions {
  page?: number;
  limit?: number;
}

class DirectMessageService {
  private buildConversationKey(workspaceId: string, userId1: string, userId2: string): string {
    const [a, b] = [userId1, userId2].map(String).sort();
    return `${workspaceId}:${a}:${b}`;
  }

  /**
   * Find or create conversation between two users
   */
  async findOrCreateConversation(userId1: string, userId2: string, workspaceId: string): Promise<any> {
    // Prevent self-conversation
    if (userId1 === userId2) {
      throw new AppError("Cannot create conversation with yourself", 400);
    }

    // Verify both users exist
    const users = await User.find({
      _id: { $in: [userId1, userId2] },
    }).lean();

    if (users.length !== 2) {
      throw new AppError("One or both users not found", 404);
    }

    // Sort participants for consistent ordering
    const participants = [userId1, userId2].sort();

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    }).select("members.user owner").lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const memberIds = new Set([
      workspace.owner?.toString?.(),
      ...(workspace.members || []).map((m: any) => m.user?.toString?.()),
    ]);

    if (!memberIds.has(userId1) || !memberIds.has(userId2)) {
      throw new AppError("Both users must be members of the same workspace for this DM", 403);
    }

    const conversationKey = this.buildConversationKey(workspaceId, userId1, userId2);

    // Prefer key-based lookup (fast + deterministic).
    const findQuery: any = { conversationKey };

    let conversation = await Conversation.findOne(findQuery)
      .populate("participants", "name email avatar profilePicture")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email avatar profilePicture" },
      });

    // Create if doesn't exist
    if (!conversation) {
      try {
        conversation = await Conversation.create({
          workspace: workspaceId,
          participants,
          conversationKey,
          lastMessageAt: new Date(),
        });
      } catch (error: any) {
        // Another request may have inserted the same conversation concurrently.
        if (error?.code === 11000) {
          conversation = await Conversation.findOne(findQuery)
            .populate("participants", "name email avatar profilePicture")
            .populate({
              path: "lastMessage",
              populate: { path: "sender", select: "name email avatar profilePicture" },
            });
        } else {
          throw error;
        }
      }

      if (conversation && !conversation.populated?.("participants")) {
        await conversation.populate("participants", "name email avatar profilePicture");
      }
    }

    return conversation;
  }

  /**
   * Start a conversation (find or create)
   */
  async startConversation(userId: string, targetUserId: string, workspaceId: string): Promise<any> {
    const conversation = await this.findOrCreateConversation(userId, targetUserId, workspaceId);
    return conversation;
  }

  /**
   * Send a direct message
   */
  async sendMessage(data: SendMessageData): Promise<any> {
    const { senderId, targetUserId, content, workspaceId } = data;

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError("Message content cannot be empty", 400);
    }

    if (content.length > 5000) {
      throw new AppError("Message content too long (max 5000 characters)", 400);
    }

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(senderId, targetUserId, workspaceId);

    // Create message
    const message = await DirectMessage.create({
      conversation: conversation._id,
      sender: senderId,
      content: content.trim(),
      readBy: [senderId], // Sender has read their own message
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate message
    await message.populate("sender", "name email avatar profilePicture");

    let recipientPreferences: any = null;
    let isSenderMutedByRecipient = false;

    try {
      const recipient = await User.findById(targetUserId)
        .select("notificationPreferences")
        .lean();
      recipientPreferences = recipient?.notificationPreferences || null;

      const mutedUsers = Array.isArray(recipientPreferences?.mutedUsers)
        ? recipientPreferences.mutedUsers
        : [];
      isSenderMutedByRecipient = mutedUsers.includes(senderId);
    } catch (error) {
      recipientPreferences = null;
    }

    // Log activity (use first participant's workspace if available, or skip workspace)
    try {
      await logger.logActivity({
        userId: senderId,
        workspaceId: null as any, // DMs are not workspace-specific
        action: "CREATE",
        resourceType: "DirectMessage",
        resourceId: message._id.toString(),
        metadata: {
          conversationId: conversation._id.toString(),
          targetUserId,
          contentLength: content.length,
        },
      });
    } catch (error) {
      console.error("[DirectMessage] Failed to log activity:", error);
    }

    // Emit real-time event to both sender and receiver
    try {
      const messageData = {
        message: {
          _id: message._id,
          workspace: conversation.workspace ? conversation.workspace.toString() : undefined,
          conversation: conversation._id,
          sender: message.sender,
          content: message.content,
          readBy: message.readBy,
          createdAt: message.createdAt,
        },
        conversation: {
          _id: conversation._id,
          workspace: conversation.workspace ? conversation.workspace.toString() : undefined,
          participants: conversation.participants,
          lastMessageAt: conversation.lastMessageAt,
        },
      };
      
      // Emit to receiver unless they muted the sender
      if (!isSenderMutedByRecipient) {
        emitToUser(targetUserId, "dm:new", messageData);
      }
      
      // Also emit to sender so they see their own message
      emitToUser(senderId, "dm:new", messageData);
    } catch (error) {
      console.error("[DirectMessage] Failed to emit real-time event:", error);
    }

    // Send notification to receiver using enhanced notification service
    // This handles both online (socket) and offline (FCM push) users automatically
    try {
      if (!isSenderMutedByRecipient) {
        await enhancedNotificationService.notifyDirectMessage(
          conversation._id.toString(),
          senderId,
          targetUserId,
          content,
          recipientPreferences
        );
      }
    } catch (error) {
      console.error("[DirectMessage] Failed to send notification:", error);
    }

    return {
      message,
      conversation,
    };
  }

  /**
   * Get user's conversations in a workspace
   */
  async getConversations(
    userId: string,
    workspaceId: string,
    options: GetConversationsOptions = {}
  ): Promise<any> {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    }).select("members.user owner").lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const memberIds = new Set([
      workspace.owner?.toString?.(),
      ...(workspace.members || []).map((m: any) => m.user?.toString?.()),
    ]);

    if (!memberIds.has(userId)) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const baseQuery: any = {
      workspace: workspaceId,
      participants: userId,
    };

    const total = await Conversation.countDocuments(baseQuery);

    const conversations = await Conversation.find(baseQuery)
      .populate("participants", "name email avatar profilePicture")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email avatar profilePicture" },
      })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Aggregate unread counts in one query (avoid N+1 countDocuments).
    const conversationIds = conversations.map((c: any) => c._id);
    const unreadRows = await DirectMessage.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      { $group: { _id: "$conversation", unreadCount: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(
      unreadRows.map((row: any) => [row._id.toString(), row.unreadCount || 0])
    );

    // Soft de-dup for legacy duplicate conversations:
    // keep only most recent conversation per other participant in this workspace.
    const dedupMap = new Map<string, any>();
    for (const conv of conversations) {
      const otherParticipant = (conv.participants || []).find(
        (p: any) => p?._id?.toString?.() !== userId
      );
      const dedupKey = otherParticipant?._id?.toString?.() || conv._id.toString();
      if (!dedupMap.has(dedupKey)) {
        dedupMap.set(dedupKey, {
          ...conv,
          unreadCount: unreadMap.get(conv._id.toString()) || 0,
        });
      }
    }

    const conversationsWithUnread = Array.from(dedupMap.values());

    return {
      conversations: conversationsWithUnread,
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
   * Get messages in a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    options: GetMessagesOptions
  ): Promise<any> {
    // Verify user is participant
    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }
    if ((conversation as any).workspace?.toString?.() !== options.workspaceId) {
      throw new AppError("Conversation does not belong to the requested workspace", 403);
    }

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await DirectMessage.countDocuments({
      conversation: conversationId,
    });

    // Get messages (sorted by newest first, then reversed for ASC display)
    const messages = await DirectMessage.find({
      conversation: conversationId,
    })
      .populate("sender", "name email avatar profilePicture")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    messages.reverse();

    // Mark messages as read by current user
    try {
      await DirectMessage.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
        {
          $addToSet: { readBy: userId },
        }
      );
    } catch (error) {
      console.error("[DirectMessage] Failed to mark messages as read:", error);
    }

    return {
      messages,
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
   * Get single conversation by ID
   */
  async getConversationById(conversationId: string, userId: string, workspaceId: string): Promise<any> {
    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name email avatar profilePicture")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email avatar profilePicture" },
      })
      .lean();

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some(
      (p: any) => p._id.toString() === userId
    );

    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }
    if ((conversation as any).workspace?.toString?.() !== workspaceId) {
      throw new AppError("Conversation does not belong to the requested workspace", 403);
    }

    // Calculate unread count
    const unreadCount = await DirectMessage.countDocuments({
      conversation: conversationId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    });

    return {
      ...conversation,
      unreadCount,
    };
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId: string, userId: string, workspaceId: string): Promise<void> {
    // Verify user is participant
    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }
    if ((conversation as any).workspace?.toString?.() !== workspaceId) {
      throw new AppError("Conversation does not belong to the requested workspace", 403);
    }

    // Mark all messages as read
    await DirectMessage.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );
  }
}

module.exports = new DirectMessageService();

export {};
