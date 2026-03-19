"use strict";
/**
 * @swagger
 * /api/workspaces/{workspaceId}/chat:
 *   get:
 *     summary: Get workspace chat messages
 *     description: Returns chat messages for a workspace
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
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages before this timestamp
 *     responses:
 *       200:
 *         description: Chat messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   workspace:
 *                     type: string
 *                   sender:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                   content:
 *                     type: string
 *                   mentions:
 *                     type: array
 *                     items:
 *                       type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *   post:
 *     summary: Send a chat message
 *     description: Sends a new message to workspace chat
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
 *                 description: Message content
 *                 example: "Hello team! Let's discuss the new feature."
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs mentioned in the message
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 workspace:
 *                   type: string
 *                 sender:
 *                   type: string
 *                 content:
 *                   type: string
 *                 mentions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
