const express = require("express");
const router = express.Router();
const directMessageController = require("../controllers/directMessageController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { sendMessageSchema } = require("../validators/directMessageValidators");

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/dm:
 *   get:
 *     summary: Get all conversations
 *     description: Retrieve direct message conversations for the current user inside a specific workspace.
 *     tags: ["5.3 Collaboration — Direct Messages"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace scope. Only conversations involving members of this workspace are returned.
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675700"
 *                   participants:
 *                     - _id: "69bce50b96fe109fe4e14ff6"
 *                       name: "Alice Smith"
 *                       avatar: null
 *                   lastMessage:
 *                     content: "See you tomorrow!"
 *                     sender: "69bce50b96fe109fe4e14ff6"
 *                     createdAt: "2026-03-30T12:00:00Z"
 *                   unreadCount: 2
 *       401:
 *         description: Authentication required
 *       400:
 *         description: workspaceId is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/", directMessageController.getConversations);

/**
 * @swagger
 * /api/dm/{userId}:
 *   post:
 *     summary: Start conversation
 *     description: Start a new conversation with a user in a workspace scope or retrieve the existing one.
 *     tags: ["5.3 Collaboration — Direct Messages"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to start conversation with
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Optional workspace ID used to scope the DM conversation. If omitted, the backend will auto-resolve a shared workspace between the two users.
 *     responses:
 *       200:
 *         description: Conversation started or retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f71675700"
 *                 participants: [...]
 *       400:
 *         description: Bad Request (e.g. starting conversation with yourself or no shared workspace found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Target user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/:userId", directMessageController.startConversation);

/**
 * @swagger
 * /api/dm/{conversationId}:
 *   get:
 *     summary: Get conversation details
 *     description: Retrieve a specific conversation by its ID, including full participant details.
 *     tags: ["5.3 Collaboration — Direct Messages"]
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
 *         description: Conversation retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f71675700"
 *                 participants: [...]
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/:conversationId", directMessageController.getConversation);

/**
 * @swagger
 * /api/dm/{userId}/message:
 *   post:
 *     summary: Send direct message
 *     description: |
 *       Sends a message to another user. If no conversation exists, it creates one automatically.
 *       **Note:** Message content cannot be empty unless attachments are provided.
 *       `workspaceId` is optional. When omitted, the backend will auto-resolve a shared workspace between the sender and recipient.
 *     tags: ["5.3 Collaboration — Direct Messages"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recipient User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/DMMessageInput"
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f71675701"
 *                 content: "Hey! Did you see the new update?"
 *                 sender: "69bcc46789cab60dfa454499"
 *                 createdAt: "2026-03-30T12:05:00Z"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Subscription limit reached (if applicable) or workspace membership validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     description: Retrieve paginated messages in a conversation, newest first.
 *     tags: ["5.3 Collaboration — Direct Messages"]
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to retrieve per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675701"
 *                   content: "Hey! Did you see the new update?"
 *                   sender: "69bcc46789cab60dfa454499"
 *                   createdAt: "2026-03-30T12:05:00Z"
 *               pagination:
 *                 total: 120
 *                 page: 1
 *                 limit: 50
 *                 pages: 3
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/:conversationId/messages", directMessageController.getMessages);

/**
 * @swagger
 * /api/dm/{conversationId}/read:
 *   patch:
 *     summary: Mark conversation as read
 *     description: Marks all unread messages in the conversation as read for the current user.
 *     tags: ["5.3 Collaboration — Direct Messages"]
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Messages marked as read"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.patch("/:conversationId/read", directMessageController.markAsRead);

module.exports = router;

export {};
