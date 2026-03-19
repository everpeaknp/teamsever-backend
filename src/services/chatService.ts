const ChatMessage = require("../models/ChatMessage");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
const notificationService = require("./notificationService");

interface CreateMessageData {
  workspaceId: string;
  senderId: string;
  content: string;
  type?: "text" | "system";
  mentions?: string[];
}

interface GetMessagesOptions {
  page?: number;
  limit?: number;
}

class ChatService {
  /**
   * Validate if user is a workspace member
   */
  async validateWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You must be a workspace member to access chat", 403);
    }
  }

  /**
   * Create a new chat message
   */
  async createMessage(data: CreateMessageData) {
    const { workspaceId, senderId, content, type = "text", mentions = [] } = data;

    // Validate workspace membership
    await this.validateWorkspaceMembership(workspaceId, senderId);

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new AppError("Message content cannot be empty", 400);
    }

    if (content.length > 5000) {
      throw new AppError("Message content too long (max 5000 characters)", 400);
    }

    // Create message
    const message = await ChatMessage.create({
      workspace: workspaceId,
      sender: senderId,
      content: content.trim(),
      type,
      mentions,
    });

    // Populate sender info
    await message.populate("sender", "name email");

    // Log activity (non-blocking)
    try {
      await logger.logActivity({
        userId: senderId,
        workspaceId,
        action: "CHAT_MESSAGE_CREATED",
        resourceType: "ChatMessage",
        resourceId: message._id.toString(),
        metadata: { contentLength: content.length },
      });
    } catch (error) {
      console.error("Failed to log chat message activity:", error);
    }

    // Send push notifications to mentioned users (non-blocking)
    if (mentions && mentions.length > 0) {
      try {
        const sender = await User.findById(senderId).select("name").lean();
        const senderName = sender?.name || "Someone";
        const messagePreview = content.length > 100 ? content.substring(0, 100) + "..." : content;

        // Send notification to each mentioned user via central pipeline
        mentions.forEach((mentionedUserId) => {
          notificationService.createNotification({
            recipientId: mentionedUserId,
            type: "MENTION",
            title: "You were mentioned",
            body: `${senderName}: ${messagePreview}`,
            data: {
              resourceId: message._id.toString(),
              resourceType: "ChatMessage",
              workspaceId,
              messageId: message._id.toString(),
            },
          }).catch((error: any) => {
            console.error(`Failed to send mention notification to ${mentionedUserId}:`, error);
          });
        });
      } catch (error) {
        console.error("Failed to send mention notifications:", error);
      }
    }

    return message;
  }

  /**
   * Get workspace messages with pagination
   */
  async getWorkspaceMessages(
    workspaceId: string,
    userId: string,
    options: GetMessagesOptions = {}
  ) {
    // Validate workspace membership
    await this.validateWorkspaceMembership(workspaceId, userId);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      workspace: workspaceId,
      isDeleted: false,
    };

    // Get total count
    const total = await ChatMessage.countDocuments(query);

    // Get messages sorted by newest first
    const messages = await ChatMessage.find(query)
      .populate("sender", "name email")
      .populate("mentions", "name email")
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    // Reverse to show oldest first within the page (for chronological display)
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
  }

  /**
   * Delete a chat message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await ChatMessage.findOne({
      _id: messageId,
      isDeleted: false,
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Validate workspace membership
    await this.validateWorkspaceMembership(message.workspace.toString(), userId);

    // Only sender can delete their own message
    if (message.sender.toString() !== userId) {
      throw new AppError("You can only delete your own messages", 403);
    }

    // Soft delete
    await softDelete(ChatMessage, messageId);

    // Log activity (non-blocking)
    try {
      await logger.logActivity({
        userId,
        workspaceId: message.workspace.toString(),
        action: "DELETE",
        resourceType: "ChatMessage",
        resourceId: messageId,
      });
    } catch (error) {
      console.error("Failed to log chat message deletion:", error);
    }

    return { message: "Message deleted successfully" };
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(messageId: string, userId: string) {
    const message = await ChatMessage.findOne({
      _id: messageId,
      isDeleted: false,
    })
      .populate("sender", "name email")
      .populate("mentions", "name email")
      .lean();

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Validate workspace membership
    await this.validateWorkspaceMembership(message.workspace.toString(), userId);

    return message;
  }
}

module.exports = new ChatService();

export {};
