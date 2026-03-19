const chatService = require("../services/chatService");
const asyncHandler = require("../utils/asyncHandler");

/**
 * @desc    Send a message to workspace chat
 * @route   POST /api/workspaces/:workspaceId/chat
 * @access  Private (workspace members only)
 */
const sendMessage = asyncHandler(async (req: any, res: any) => {
  const { workspaceId } = req.params;
  const { content, mentions } = req.body;
  const senderId = req.user.id;

  const message = await chatService.createMessage({
    workspaceId,
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
 * @desc    Get workspace chat messages
 * @route   GET /api/workspaces/:workspaceId/chat
 * @access  Private (workspace members only)
 */
const getMessages = asyncHandler(async (req: any, res: any) => {
  console.log('[ChatController] getMessages called', { workspaceId: req.params.workspaceId, query: req.query });
  
  const { workspaceId } = req.params;
  const { page, limit } = req.query;
  const userId = req.user.id;

  const result = await chatService.getWorkspaceMessages(workspaceId, userId, {
    page: page ? parseInt(page) : undefined,
    limit: limit ? parseInt(limit) : undefined,
  });

  console.log('[ChatController] Messages retrieved', { count: result.messages.length });

  res.status(200).json({
    success: true,
    data: result.messages,
    pagination: result.pagination,
  });
});

/**
 * @desc    Delete a chat message
 * @route   DELETE /api/chat/:id
 * @access  Private (message sender only)
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

module.exports = {
  sendMessage,
  getMessages,
  deleteMessage,
};

export {};
