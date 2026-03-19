/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     summary: Create a new workspace
 *     description: Creates a new workspace with the authenticated user as owner
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Workspace name
 *                 example: "Acme Corp Projects"
 *     responses:
 *       201:
 *         description: Workspace created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: Get all user workspaces
 *     description: Returns all workspaces where the user is a member
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Workspace'
 *       401:
 *         description: Unauthorized
 *
 * /api/workspaces/{id}:
 *   get:
 *     summary: Get a single workspace
 *     description: Returns workspace details with populated members
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *   patch:
 *     summary: Update workspace
 *     description: Updates workspace properties (owner/admin only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: New workspace name
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace not found
 *   delete:
 *     summary: Delete workspace
 *     description: Deletes a workspace (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only owner can delete workspace
 *       404:
 *         description: Workspace not found
 *
 * /api/workspaces/{id}/members:
 *   post:
 *     summary: Add member to workspace
 *     description: Adds a user to the workspace (admin/owner only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID to add
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *                 default: member
 *                 description: Member role
 *     responses:
 *       200:
 *         description: Member added successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace or user not found
 *
 * /api/workspaces/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from workspace
 *     description: Removes a user from the workspace (admin/owner only)
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace or member not found
 */

export {};
