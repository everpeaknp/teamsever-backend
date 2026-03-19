const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const enhancedNotificationService = require("./enhancedNotificationService");
const { emitToUser } = require("../socket/events");

interface SendMessageData {
  senderId: string;
  targetUserId: string;
  content: string;
}

interface GetMessagesOptions {
  page?: number;
  limit?: number;
}

class DirectMessageService {
  /**
   * Find or create conversation between two users
   */
  async findOrCreateConversation(userId1: string, userId2: string): Promise<any> {
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

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: participants },
    })
      .populate("participants", "name email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email" },
      });

    // Create if doesn't exist
    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        lastMessageAt: new Date(),
      });

      await conversation.populate("participants", "name email");
    }

    return conversation;
  }

  /**
   * Start a conversation (find or create)
   */
  async startConversation(userId: string, targetUserId: string): Promise<any> {
    const conversation = await this.findOrCreateConversation(userId, targetUserId);
    return conversation;
  }

  /**
   * Send a direct message
   */
  async sendMessage(data: SendMessageData): Promise<any> {
    const { senderId, targetUserId, content } = data;

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError("Message content cannot be empty", 400);
    }

    if (content.length > 5000) {
      throw new AppError("Message content too long (max 5000 characters)", 400);
    }

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(senderId, targetUserId);

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
    await message.populate("sender", "name email");

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
          conversation: conversation._id,
          sender: message.sender,
          content: message.content,
          readBy: message.readBy,
          createdAt: message.createdAt,
        },
        conversation: {
          _id: conversation._id,
          participants: conversation.participants,
          lastMessageAt: conversation.lastMessageAt,
        },
      };
      
      // Emit to receiver
      emitToUser(targetUserId, "dm:new", messageData);
      
      // Also emit to sender so they see their own message
      emitToUser(senderId, "dm:new", messageData);
    } catch (error) {
      console.error("[DirectMessage] Failed to emit real-time event:", error);
    }

    // Send notification to receiver using enhanced notification service
    // This handles both online (socket) and offline (FCM push) users automatically
    try {
      await enhancedNotificationService.notifyDirectMessage(
        conversation._id.toString(),
        senderId,
        targetUserId,
        content
      );
    } catch (error) {
      console.error("[DirectMessage] Failed to send notification:", error);
    }

    return {
      message,
      conversation,
    };
  }

  /**
   * Get user's conversations
   */
  async getConversations(userId: string): Promise<any[]> {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email" },
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv: any) => {
        const unreadCount = await DirectMessage.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });

        return {
          ...conv,
          unreadCount,
        };
      })
    );

    return conversationsWithUnread;
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    options: GetMessagesOptions = {}
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

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await DirectMessage.countDocuments({
      conversation: conversationId,
    });

    // Get messages (sorted by createdAt ASC for chat-style)
    const messages = await DirectMessage.find({
      conversation: conversationId,
    })
      .populate("sender", "name email")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

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
  async getConversationById(conversationId: string, userId: string): Promise<any> {
    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email" },
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
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
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
