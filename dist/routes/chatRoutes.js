"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { checkMessageLimit } = require("../middlewares/messageLimitMiddleware");
const validate = require("../utils/validation");
const { sendMessageSchema } = require("../validators/chatValidators");
/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Workspace chat messaging
 */
// Workspace chat routes
const workspaceChatRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat:
 *   post:
 *     summary: Send chat message
 *     description: Send a message in workspace chat
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
 *               content:
 *                 type: string
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not a member of this workspace
 *   get:
 *     summary: Get chat messages
 *     description: Retrieve chat messages for a workspace
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of messages to retrieve
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Get messages before this message ID (pagination)
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not a member of this workspace
 */
workspaceChatRouter
    .route("/")
    .post(protect, checkMessageLimit, validate(sendMessageSchema), chatController.sendMessage)
    .get(protect, chatController.getMessages);
// Individual message routes
const chatRouter = express.Router();
/**
 * @swagger
 * /api/chat/{id}:
 *   delete:
 *     summary: Delete chat message
 *     description: Delete a chat message (author or workspace admin only)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this message
 *       404:
 *         description: Message not found
 */
chatRouter.route("/:id").delete(protect, chatController.deleteMessage);
module.exports = {
    workspaceChatRouter,
    chatRouter,
};
