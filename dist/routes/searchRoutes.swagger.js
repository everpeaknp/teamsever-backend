"use strict";
/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global search
 *     description: |
 *       Performs a global search across workspace resources including:
 *       - Tasks
 *       - Documents
 *       - Spaces
 *       - Lists
 *       
 *       Uses MongoDB text indexes for efficient full-text search.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *         example: "authentication feature"
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID to search within
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, tasks, docs, spaces, lists]
 *           default: all
 *         description: Type of resources to search
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of results per type
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 docs:
 *                   type: array
 *                   items:
 *                     type: object
 *                 spaces:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Space'
 *                 lists:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/List'
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
