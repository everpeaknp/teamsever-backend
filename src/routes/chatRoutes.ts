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
 */
workspaceChatRouter
  .route("/channels/:channelId")
  .patch(protect, chatController.updateChannel);

workspaceChatRouter
  .route("/unread")
  .get(protect, chatController.getWorkspaceUnreadCount);

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
