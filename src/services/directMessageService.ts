const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const leaveService = require("./leaveService");
const logger = require("../utils/logger");
const enhancedNotificationService = require("./enhancedNotificationService");
const { emitToUser } = require("../socket/events");
const socketService = require("./socketService").default || require("./socketService");
const apiReadCacheService = require("./apiReadCacheService").default;

interface SendMessageData {
  senderId: string;
  targetUserId: string;
  content: string;
  attachments?: string[];
  workspaceId: string;
  replyToMessageId?: string;
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
    const { senderId, targetUserId, content, attachments = [], workspaceId, replyToMessageId } = data;

    // Validate content
    if ((!content || content.trim().length === 0) && attachments.length === 0) {
      throw new AppError("Message content or an image is required", 400);
    }

    if (attachments.length > 5) throw new AppError("A message may contain at most 5 images", 400);

    if (content.length > 5000) {
      throw new AppError("Message content too long (max 5000 characters)", 400);
    }

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(senderId, targetUserId, workspaceId);

    let replyTo: any = undefined;
    if (replyToMessageId) {
      replyTo = await DirectMessage.findOne({
        _id: replyToMessageId,
        conversation: conversation._id,
      }).select("_id");
      if (!replyTo) throw new AppError("Reply target is not in this conversation", 400);
    }

    // Create message
    const message = await DirectMessage.create({
      conversation: conversation._id,
      sender: senderId,
      content: (content || "").trim(),
      attachments,
      readBy: [senderId], // Sender has read their own message
      ...(replyTo ? { replyTo: replyTo._id } : {}),
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Invalidate before emitting dm:new; socket-driven refreshes should see
    // the just-created message instead of a cached older page.
    await apiReadCacheService.invalidateNamespace("chat-messages");

    // Populate message
    await message.populate("sender", "name email avatar profilePicture");
    await message.populate({ path: "replyTo", select: "content sender createdAt isDeleted", populate: { path: "sender", select: "name avatar profilePicture" } });

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
          attachments: message.attachments || [],
          type: message.type,
          metadata: message.metadata,
          isDeleted: message.isDeleted || false,
          readBy: message.readBy,
          replyTo: message.replyTo,
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
          content.trim() || (attachments.length > 0 ? "sent a photo" : ""),
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

    // Keep interactive leave/remote cards truthful when the conversation is
    // opened after the request's final day. This runs only after membership
    // and workspace access have been verified, and updates the DM metadata.
    await leaveService.expireWorkspaceRequests(options.workspaceId);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    await this.markConversationAsRead(conversationId, userId, options.workspaceId);

    const cachedPage = await apiReadCacheService.getOrLoad(
      `conversation:${conversationId}:user:${userId}:page:${page}:limit:${limit}`,
      10,
      async () => {
        const total = await DirectMessage.countDocuments({ conversation: conversationId });
        const messages = await DirectMessage.find({ conversation: conversationId })
          .populate("sender", "name email avatar profilePicture")
          .populate("readBy", "name avatar profilePicture")
          .populate({ path: "replyTo", select: "content sender createdAt isDeleted", populate: { path: "sender", select: "name avatar profilePicture" } })
          .populate("reactions.users", "name avatar profilePicture")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        messages.reverse();
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
      },
      "chat-messages",
    );

    return cachedPage;
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

    const unreadMessages = await DirectMessage.find({
      conversation: conversationId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    }).select("_id").lean();
    if (!unreadMessages.length) return;

    const messageIds = unreadMessages.map((message: any) => message._id);
    await DirectMessage.updateMany(
      {
        _id: { $in: messageIds },
      },
      {
        $addToSet: { readBy: userId },
      }
    );
    await apiReadCacheService.invalidateNamespace("chat-messages");
    const User = require("../models/User");
    const reader = await User.findById(userId).select("_id name avatar profilePicture").lean();
    const socketService = require("./socketService");
    socketService.emitToUsers(conversation.participants.map((p: any) => p.toString()), "dm:read", {
      conversationId,
      messageIds,
      reader,
      readAt: new Date(),
    });
  }

  /** Keep a DM tombstone in the thread while removing its original contents. */
  async deleteMessage(messageId: string, userId: string) {
    const message = await DirectMessage.findById(messageId);
    if (!message) throw new AppError("Message not found", 404);
    if (message.type && message.type !== "text") {
      throw new AppError("Only text messages can be deleted", 400);
    }
    if (message.sender.toString() !== userId.toString()) {
      throw new AppError("You can only delete your own messages", 403);
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation) throw new AppError("Conversation not found", 404);
    const isParticipant = conversation.participants.some(
      (participant: any) => participant.toString() === userId.toString()
    );
    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }
    if (message.isDeleted) return message;

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId as any;
    message.content = "This message was deleted";
    message.reactions = [];
    message.metadata = null;
    await message.save();
    await apiReadCacheService.invalidateNamespace("chat-messages");
    await message.populate("sender", "name email avatar profilePicture");

    try {
      const participantIds = conversation.participants.map((participant: any) =>
        participant.toString()
      );
      socketService.emitToUsers?.(participantIds, "dm:updated", {
        message,
        conversationId: conversation._id,
      });
    } catch (error) {
      console.error("[DirectMessageService] Failed to emit deleted message:", error);
    }

    return message;
  }

  /**
   * Toggle emoji reaction on a direct message
   */
  async toggleReaction(messageId: string, userId: string, emoji: string) {
    if (!emoji || !emoji.trim()) {
      throw new AppError("Emoji is required", 400);
    }

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Validate participant in the conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    const userAlreadyReactedSameEmoji = message.reactions.some(
      (r: any) => r.emoji === emoji && r.users.some((u: any) => u.toString() === userId.toString())
    );

    // Remove user from ALL reactions on this message (one person, one react)
    for (let i = message.reactions.length - 1; i >= 0; i--) {
      const r = message.reactions[i];
      const uIdx = r.users.findIndex((u: any) => u.toString() === userId.toString());
      if (uIdx > -1) {
        r.users.splice(uIdx, 1);
        r.count = r.users.length;
        if (r.count === 0) {
          message.reactions.splice(i, 1);
        }
      }
    }

    // If user wasn't already reacting with this exact emoji, add them to it
    if (!userAlreadyReactedSameEmoji) {
      const existingReaction = message.reactions.find((r: any) => r.emoji === emoji);
      if (existingReaction) {
        existingReaction.users.push(userId as any);
        existingReaction.count = existingReaction.users.length;
      } else {
        message.reactions.push({
          emoji,
          users: [userId as any],
          count: 1,
        });
      }
    }

    await message.save();
    await apiReadCacheService.invalidateNamespace("chat-messages");
    await message.populate("sender", "name email avatar profilePicture");
    await message.populate("reactions.users", "name avatar profilePicture");

    // DM clients use personal user rooms; the server does not require them to
    // join a separate conversation room.
    try {
      socketService.emitToUsers?.(conversation.participants.map((p: any) => p.toString()), "dm:reaction", {
        messageId: message._id,
        conversationId: message.conversation,
        reactions: message.reactions,
        userId,
        emoji,
      });
    } catch (err) {
      console.error("[DirectMessageService] Failed to emit reaction socket event:", err);
    }

    return message;
  }
}

module.exports = new DirectMessageService();

export {};
