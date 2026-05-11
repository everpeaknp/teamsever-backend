const chatService = require("../services/chatService");
const asyncHandler = require("../utils/asyncHandler");
const ChatChannel = require("../models/ChatChannel");
const ChatMessage = require("../models/ChatMessage");
const Workspace = require("../models/Workspace");

/**
 * @desc    Create a new chat channel
 * @route   POST /api/workspaces/:workspaceId/chat/channels
 * @access  Private (Admin/Owner only)
 */
const createChannel = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const { name, description, type, members } = req.body;
  const userId = req.user.id;

  const channel = await chatService.createChannel(workspaceId, userId, {
    name,
    description,
    type,
    members,
  });

  res.status(201).json({
    success: true,
    data: channel,
  });
});

/**
 * @desc    Get all accessible channels in a workspace
 * @route   GET /api/workspaces/:workspaceId/chat/channels
 * @access  Private (workspace members only)
 */
const getChannels = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

  const result = await chatService.getChannels(workspaceId, userId, { page, limit });

  res.status(200).json({
    success: true,
    data: result.channels,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get messages for a specific channel
 * @route   GET /api/chat/channels/:channelId/messages
 * @access  Private (channel members only)
 */
const getChannelMessages = asyncHandler(async (req: any, res: any) => {
  const { channelId } = req.params;
  const { page, limit } = req.query;
  const userId = req.user.id;

  const result = await chatService.getChannelMessages(channelId, userId, {
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
    userId: req.query.userId, // Filter by user if provided
  });

  res.status(200).json({
    success: true,
    data: result.messages,
    channel: result.channel,
    pagination: result.pagination,
  });
});

/**
 * @desc    Send a message to a specific channel
 * @route   POST /api/workspaces/:workspaceId/chat
 * @access  Private (channel members only)
 */
const sendMessage = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const { channelId, content, mentions } = req.body;
  const senderId = req.user.id;

  const message = await chatService.createMessage({
    workspaceId,
    channelId,
    senderId,
    content,
    mentions,
  });

  // Include message usage in response
  const response: any = {
    success: true,
    data: message,
  };

  if (req.messageUsage) {
    response.messageUsage = req.messageUsage;
  }

  res.status(201).json(response);
});

/**
 * @desc    Delete a chat message
 * @route   DELETE /api/chat/:id
 * @access  Private (sender or Admin/Owner)
 */
const deleteMessage = asyncHandler(async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await chatService.deleteMessage(id, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * @desc    Get unread message count for a channel
 * @route   GET /api/chat/channels/:channelId/unread
 * @access  Private (channel members only)
 */
const getUnreadCount = asyncHandler(async (req: any, res: any) => {
  const { channelId } = req.params;
  const userId = req.user.id;

  const count = await chatService.getUnreadCount(channelId, userId);

  res.status(200).json({
    success: true,
    data: { unreadCount: count },
  });
});

/**
 * @desc    Update channel details
 * @route   PUT /api/workspaces/:workspaceId/chat/channels/:channelId
 * @access  Private (Admin/Owner only)
 */
const updateChannel = asyncHandler(async (req: any, res: any) => {
  const { workspaceId, channelId } = req.params;
  const userId = req.user.id;

  const channel = await chatService.updateChannel(workspaceId, channelId, userId, req.body);

  res.status(200).json({
    success: true,
    data: channel,
  });
});

/**
 * @desc    Delete channel
 * @route   DELETE /api/workspaces/:workspaceId/chat/channels/:channelId
 * @access  Private (creator, admin, owner)
 */
const deleteChannel = asyncHandler(async (req: any, res: any) => {
  const { workspaceId, channelId } = req.params;
  const userId = req.user.id;

  const result = await chatService.deleteChannel(workspaceId, channelId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * @desc    Get aggregate unread count for all accessible channels in a workspace
 * @route   GET /api/workspaces/:workspaceId/chat/unread
 * @access  Private
 */
/**
 * @desc    Get workspace-wide messages (usually from General channel)
 * @route   GET /api/workspaces/:workspaceId/chat
 * @access  Private
 */
const getWorkspaceMessages = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const { page, limit } = req.query;
  const userId = req.user.id;

  const result = await chatService.getChannelMessages('general', userId, {
    workspaceId,
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
    userId: req.query.userId, // Filter by user if provided
  });

  res.status(200).json({
    success: true,
    data: result.messages,
    channel: result.channel,
    pagination: result.pagination,
  });
});

const getWorkspaceUnreadCount = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  const { membership } = await chatService.validateWorkspaceMembership(workspaceId, userId);
  const isAdmin = membership?.role === "admin" || membership?.role === "owner";

  const channelQuery: any = {
    workspace: workspaceId,
    isDeleted: false,
  };

  if (!isAdmin) {
    channelQuery.$or = [{ type: "public" }, { type: "private", members: userId }];
  }

  const accessibleChannels = await ChatChannel.find(channelQuery).select("_id").lean();
  const channelIds = accessibleChannels.map((c: any) => c._id);

  if (channelIds.length === 0) {
    return res.status(200).json({
      success: true,
      data: { unreadCount: 0 },
    });
  }

  const unreadQuery: any = {
    workspace: workspaceId,
    channel: { $in: channelIds },
    isDeleted: false,
    sender: { $ne: userId },
  };

  if (membership?.lastChatReadAt) {
    unreadQuery.createdAt = { $gt: membership.lastChatReadAt };
  }

  const unreadCount = await ChatMessage.countDocuments(unreadQuery);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
});

const markWorkspaceChatAsRead = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  await chatService.validateWorkspaceMembership(workspaceId, userId);

  await Workspace.updateOne(
    {
      _id: workspaceId,
      "members.user": userId,
      isDeleted: false,
    },
    {
      $set: {
        "members.$.lastChatReadAt": new Date(),
      },
    }
  );

  res.status(200).json({
    success: true,
    message: "Workspace chat marked as read",
  });
});

module.exports = {
  createChannel,
  getChannels,
  getChannelMessages,
  sendMessage,
  deleteMessage,
  getUnreadCount,
  updateChannel,
  deleteChannel,
  getWorkspaceUnreadCount,
  markWorkspaceChatAsRead,
  getWorkspaceMessages,
};

export {};
