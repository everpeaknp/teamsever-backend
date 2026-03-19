const directMessageService = require("../services/directMessageService");
const asyncHandler = require("../utils/asyncHandler");
const EntitlementService = require("../services/entitlementService").default;

/**
 * @desc    Start or get conversation with a user
 * @route   POST /api/dm/:userId
 * @access  Private
 */
const startConversation = asyncHandler(async (req: any, res: any) => {
  const currentUserId = req.user.id;
  const { userId: targetUserId } = req.params;

  const conversation = await directMessageService.startConversation(
    currentUserId,
    targetUserId
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

  const conversations = await directMessageService.getConversations(userId);

  res.status(200).json({
    success: true,
    data: conversations,
    count: conversations.length,
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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const result = await directMessageService.getMessages(conversationId, userId, {
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

  const conversation = await directMessageService.getConversationById(
    conversationId,
    userId
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

  await directMessageService.markConversationAsRead(conversationId, userId);

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
