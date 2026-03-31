"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { checkMessageLimit } = require("../middlewares/messageLimitMiddleware");
const validate = require("../utils/validation");
const { sendMessageSchema, createChannelSchema } = require("../validators/chatValidators");
/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Multi-channel workspace chat and direct messaging
 */
// Workspace chat routes (prefixed with /api/workspaces/:workspaceId/chat)
const workspaceChatRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat:
 *   post:
 *     summary: Send chat message
 *     description: Send a message to a specific channel within a workspace. If channelId is omitted, it defaults to the #General channel.
 *     tags: [Chat]
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
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               channelId:
 *                 type: string
 *                 description: Target channel ID (optional, defaults to #General)
 *               content:
 *                 type: string
 *                 description: Message text
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: User IDs to mention
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error or channel not found
 *       403:
 *         description: Not a member of the workspace or private channel
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
 *     tags: [Chat]
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
 *   post:
 *     summary: Create new channel
 *     description: Create a new public or private chat channel. Only Admins/Owners can create channels.
 *     tags: [Chat]
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
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Channel name (e.g., "Engineering")
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [public, private]
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Initial members for private channel
 *     responses:
 *       201:
 *         description: Channel created successfully
 *       403:
 *         description: Only admins can create channels
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
 *     tags: [Chat]
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [public, private]
 *     responses:
 *       200:
 *         description: Channel updated successfully
 *       403:
 *         description: Not authorized
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
 *     tags: [Chat]
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
 */
channelRouter
    .route("/:channelId/messages")
    .get(protect, chatController.getChannelMessages);
/**
 * @swagger
 * /api/chat/channels/{channelId}/unread:
 *   get:
 *     summary: Get unread count
 *     tags: [Chat]
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
