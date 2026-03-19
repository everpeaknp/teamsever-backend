const express = require("express");
const router = express.Router();
const directMessageController = require("../controllers/directMessageController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { sendMessageSchema } = require("../validators/directMessageValidators");

/**
 * @swagger
 * tags:
 *   name: Direct Messages
 *   description: Private messaging between users
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/dm:
 *   get:
 *     summary: Get all conversations
 *     description: Retrieve all direct message conversations for the current user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/", directMessageController.getConversations);

/**
 * @swagger
 * /api/dm/{userId}:
 *   post:
 *     summary: Start conversation
 *     description: Start a new conversation with a user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to start conversation with
 *     responses:
 *       201:
 *         description: Conversation started successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: User not found
 *   get:
 *     summary: Get conversation
 *     description: Retrieve a specific conversation by ID
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Conversation not found
 */
router.post("/:userId", directMessageController.startConversation);
router.get("/:conversationId", directMessageController.getConversation);

/**
 * @swagger
 * /api/dm/{userId}/message:
 *   post:
 *     summary: Send direct message
 *     description: Send a message in a direct conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 */
router.post(
  "/:userId/message",
  validate(sendMessageSchema),
  directMessageController.sendMessage
);

/**
 * @swagger
 * /api/dm/{conversationId}/messages:
 *   get:
 *     summary: Get conversation messages
 *     description: Retrieve all messages in a conversation
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of messages to retrieve
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *         description: Get messages before this message ID
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Conversation not found
 */
router.get("/:conversationId/messages", directMessageController.getMessages);

/**
 * @swagger
 * /api/dm/{conversationId}/read:
 *   patch:
 *     summary: Mark conversation as read
 *     description: Mark all messages in a conversation as read
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation marked as read
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Conversation not found
 */
router.patch("/:conversationId/read", directMessageController.markAsRead);

module.exports = router;

export {};
