const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { checkMessageLimit } = require("../middlewares/messageLimitMiddleware");
const validate = require("../utils/validation");
const { sendMessageSchema, createChannelSchema } = require("../validators/chatValidators");

// Workspace chat routes (prefixed with /api/workspaces/:workspaceId/chat)
const workspaceChatRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat:
 *   get:
 *     summary: Get workspace message feed
 *     description: Retrieve paginated workspace message feed. Supports optional sender filtering.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional sender filter. Returns only messages created by this user.
 *     responses:
 *       200:
 *         description: Workspace messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *   post:
 *     summary: Send chat message
 *     description: Send a message to a specific channel within a workspace. If channelId is omitted, it defaults to the #General channel.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ChatMessageInput"
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Validation error or channel not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Not a member of the workspace or private channel
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
workspaceChatRouter
  .route("/")
  .get(protect, chatController.getWorkspaceMessages)
  .post(protect, checkMessageLimit, validate(sendMessageSchema), chatController.sendMessage);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat/channels:
 *   get:
 *     summary: List accessible channels
 *     description: Retrieve all public channels and any private channels the user is a member of.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: List of accessible channels
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *   post:
 *     summary: Create new channel
 *     description: Create a new public or private chat channel. Only Admins/Owners can create channels.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ChatChannelCreateInput"
 *     responses:
 *       201:
 *         description: Channel created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       403:
 *         description: Only admins can create channels
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
workspaceChatRouter
  .route("/channels")
  .get(protect, chatController.getChannels)
  .post(protect, validate(createChannelSchema), chatController.createChannel);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat/channels/{channelId}:
 *   patch:
 *     summary: Update channel details
 *     description: Rename channel, change description or visibility. Only Admins/Owners or the creator can update.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ChatChannelUpdateInput"
 *     responses:
 *       200:
 *         description: Channel updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete a channel
 *     description: Delete a custom channel. `General` and `Commit Log` are permanent and cannot be deleted.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel deleted successfully
 *       400:
 *         description: Permanent channel cannot be deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Channel not found
 */
workspaceChatRouter
  .route("/channels/:channelId")
  .patch(protect, chatController.updateChannel)
  .delete(protect, chatController.deleteChannel);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat/unread:
 *   get:
 *     summary: Get workspace chat unread count
 *     description: Returns unread count for the workspace chat feed using the caller's `Workspace.members[].lastChatReadAt` cursor. Only accessible channels/messages visible to the caller are counted.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       403:
 *         description: User is not a member of the workspace
 *       404:
 *         description: Workspace not found
 */
workspaceChatRouter
  .route("/unread")
  .get(protect, chatController.getWorkspaceUnreadCount);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat/read:
 *   patch:
 *     summary: Mark workspace chat as read
 *     description: Updates the caller's workspace chat read cursor (`Workspace.members[].lastChatReadAt`) to the current server time. This clears unread state for messages visible up to the mark time.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace chat marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       403:
 *         description: User is not a member of the workspace
 *       404:
 *         description: Workspace not found
 */
workspaceChatRouter
  .route("/read")
  .patch(protect, chatController.markWorkspaceChatAsRead);

// Channel-specific routes
const channelRouter = express.Router();

/**
 * @swagger
 * /api/chat/channels/{channelId}/messages:
 *   get:
 *     summary: Get message history for a channel
 *     description: Retrieve paginated chat history. User must have access to the channel.
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: userId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional sender filter. Returns only messages authored by this user.
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
channelRouter
  .route("/:channelId/messages")
  .get(protect, chatController.getChannelMessages);

/**
 * @swagger
 * /api/chat/channels/{channelId}/unread:
 *   get:
 *     summary: Get unread count
 *     tags: ["5.2 Collaboration — Chat Channels"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Unread message count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
channelRouter
  .route("/:channelId/unread")
  .get(protect, chatController.getUnreadCount);

// Individual message routes
const chatRouter = express.Router();

chatRouter.route("/:id").delete(protect, chatController.deleteMessage);

module.exports = {
  workspaceChatRouter,
  channelRouter,
  chatRouter,
};

export {};
