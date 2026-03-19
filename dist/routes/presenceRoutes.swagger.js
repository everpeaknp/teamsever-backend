"use strict";
/**
 * @swagger
 * /api/presence/{workspaceId}:
 *   get:
 *     summary: Get workspace presence
 *     description: Returns online/offline status of all workspace members
 *     tags: [Presence]
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
 *         description: Presence information
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [online, offline, away]
 *                   lastSeen:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *
 * /api/presence/{workspaceId}/online:
 *   get:
 *     summary: Get online users
 *     description: Returns list of currently online users in workspace
 *     tags: [Presence]
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
 *         description: List of online users
 *       401:
 *         description: Unauthorized
 *
 * /api/presence/user/{userId}:
 *   get:
 *     summary: Get user presence
 *     description: Returns presence status of a specific user
 *     tags: [Presence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User presence status
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
