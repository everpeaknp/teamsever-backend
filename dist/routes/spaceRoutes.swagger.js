"use strict";
/**
 * @swagger
 * /api/workspaces/{workspaceId}/spaces:
 *   get:
 *     summary: Get all spaces in a workspace
 *     description: Returns all spaces/projects within a workspace
 *     tags: [Spaces]
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
 *         description: List of spaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Space'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *   post:
 *     summary: Create a new space
 *     description: Creates a new space/project within a workspace
 *     tags: [Spaces]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Space name
 *                 example: "Engineering Team"
 *               description:
 *                 type: string
 *                 description: Space description
 *     responses:
 *       201:
 *         description: Space created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *
 * /api/spaces/{id}:
 *   get:
 *     summary: Get space by ID
 *     description: Returns detailed space information
 *     tags: [Spaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Space'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Space not found
 *   patch:
 *     summary: Update space
 *     description: Updates space properties
 *     tags: [Spaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Space updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Space not found
 *   delete:
 *     summary: Delete space
 *     description: Deletes a space and all its lists and tasks
 *     tags: [Spaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Space not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
