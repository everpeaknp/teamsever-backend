"use strict";
/**
 * @swagger
 * /api/dm:
 *   get:
 *     summary: Get all conversations
 *     description: Returns all direct message conversations for the current user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   participants:
 *                     type: array
 *                     items:
 *                       type: object
 *                   lastMessage:
 *                     type: object
 *                   unreadCount:
 *                     type: integer
 *       401:
 *         description: Unauthorized
 *
 * /api/dm/{userId}:
 *   post:
 *     summary: Start conversation
 *     description: Starts a new direct message conversation with a user
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
 *         description: Conversation created
 *       401:
 *         description: Unauthorized
 *
 * /api/dm/{userId}/message:
 *   post:
 *     summary: Send direct message
 *     description: Sends a message to a user
 *     tags: [Direct Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
