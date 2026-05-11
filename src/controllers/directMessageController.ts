const directMessageService = require("../services/directMessageService");
const asyncHandler = require("../utils/asyncHandler");
const EntitlementService = require("../services/entitlementService").default;

const extractWorkspaceId = (req: any): string | undefined => {
  const direct =
    req.body?.workspaceId ||
    req.query?.workspaceId ||
    req.headers?.["x-workspace-id"];

  if (direct && String(direct).trim()) {
    return String(direct).trim();
  }
  return undefined;
};

/**
 * @desc    Start or get conversation with a user
 * @route   POST /api/dm/:userId
 * @access  Private
 */
const startConversation = asyncHandler(async (req: any, res: any) => {
  const currentUserId = req.user.id;
  const { userId: targetUserId } = req.params;
  const workspaceId = extractWorkspaceId(req);

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required for direct messages",
    });
  }

  const conversation = await directMessageService.startConversation(
    currentUserId,
    targetUserId,
    workspaceId
  );

  res.status(200).json({
    success: true,
    data: conversation,
    message: "Conversation ready",
  });
});

/**
 * @desc    Send a direct message
 * @route   POST /api/dm/:userId/message
 * @access  Private
 */
const sendMessage = asyncHandler(async (req: any, res: any) => {
  const senderId = req.user.id;
  const { userId: targetUserId } = req.params;
  const { content } = req.body;
  const workspaceId = extractWorkspaceId(req);

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required for direct messages",
    });
  }

  // Check entitlement
  const entitlement = await EntitlementService.canSendDirectMessage(senderId, targetUserId);
  if (!entitlement.allowed) {
    return res.status(403).json({
      success: false,
      message: entitlement.reason || 'Cannot send direct message',
      code: 'DM_LIMIT_REACHED'
    });
  }

  const result = await directMessageService.sendMessage({
    senderId,
    targetUserId,
    content,
    workspaceId,
  });

  // Invalidate cache after sending message
  EntitlementService.invalidateEntitlementCache(senderId);

  res.status(201).json({
    success: true,
    data: result,
    message: "Message sent successfully",
  });
});

/**
 * @desc    Get all conversations for current user
 * @route   GET /api/dm
 * @access  Private
 */
const getConversations = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const workspaceId = extractWorkspaceId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required",
    });
  }

  const result = await directMessageService.getConversations(userId, workspaceId, {
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result.conversations,
    count: result.conversations.length,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get messages in a conversation
 * @route   GET /api/dm/:conversationId/messages
 * @access  Private
 */
const getMessages = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const workspaceId = extractWorkspaceId(req);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required",
    });
  }

  const result = await directMessageService.getMessages(conversationId, userId, {
    workspaceId,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    data: result.messages,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get single conversation
 * @route   GET /api/dm/:conversationId
 * @access  Private
 */
const getConversation = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const workspaceId = extractWorkspaceId(req);

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required",
    });
  }

  const conversation = await directMessageService.getConversationById(
    conversationId,
    userId,
    workspaceId
  );

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

/**
 * @desc    Mark conversation as read
 * @route   PATCH /api/dm/:conversationId/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const { conversationId } = req.params;
  const workspaceId = extractWorkspaceId(req);

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: "workspaceId is required",
    });
  }

  await directMessageService.markConversationAsRead(conversationId, userId, workspaceId);

  res.status(200).json({
    success: true,
    message: "Conversation marked as read",
  });
});

module.exports = {
  startConversation,
  sendMessage,
  getConversations,
  getMessages,
  getConversation,
  markAsRead,
};

export {};
