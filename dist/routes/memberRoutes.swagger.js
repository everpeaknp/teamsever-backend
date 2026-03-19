"use strict";
/**
 * @swagger
 * /api/workspaces/{workspaceId}/members:
 *   get:
 *     summary: Get all workspace members
 *     description: Returns all members of a workspace with their roles
 *     tags: [Members]
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
 *         description: List of workspace members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [owner, admin, member, guest]
 *                   joinedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/workspaces/{workspaceId}/members/{userId}:
 *   patch:
 *     summary: Update member role
 *     description: Updates a member's role in the workspace (admin/owner only)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member, guest]
 *                 description: New role for the member
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace or member not found
 *   delete:
 *     summary: Remove member from workspace
 *     description: Removes a member from the workspace (admin/owner only)
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (cannot remove owner)
 *       404:
 *         description: Workspace or member not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
