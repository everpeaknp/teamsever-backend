"use strict";
/**
 * @swagger
 * /api/workspaces/{workspaceId}/invites:
 *   post:
 *     summary: Create workspace invitation
 *     description: |
 *       Creates an invitation link for a workspace. Supports both email-based and link-based invitations.
 *
 *       **Invitation Types:**
 *       - **Email Invitation:** Sends email to specific address with unique token
 *       - **Link Invitation:** Generates shareable link that anyone can use
 *
 *       **Expiration:**
 *       Invitations expire after 7 days by default
 *     tags: [Invitations]
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to invite
 *                 example: "newuser@example.com"
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *                 default: member
 *                 description: Role for the invited user
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 workspace:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: Unique invitation token
 *                 inviteLink:
 *                   type: string
 *                   description: Full invitation URL
 *                   example: "http://localhost:3000/join?token=abc123xyz"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error or user already in workspace
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace not found
 *   get:
 *     summary: Get all workspace invitations
 *     description: Returns all pending invitations for a workspace
 *     tags: [Invitations]
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
 *         description: List of invitations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/invites/{token}:
 *   get:
 *     summary: Get invitation details
 *     description: Retrieves invitation details by token (public endpoint)
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workspace:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *       404:
 *         description: Invitation not found or expired
 *
 * /api/invites/{token}/accept:
 *   post:
 *     summary: Accept workspace invitation
 *     description: |
 *       Accepts an invitation and adds the user to the workspace.
 *
 *       **Process:**
 *       1. Validates invitation token
 *       2. Checks expiration
 *       3. Adds user to workspace with specified role
 *       4. Marks invitation as accepted
 *       5. Sends real-time notification to workspace members
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully joined workspace"
 *                 workspace:
 *                   $ref: '#/components/schemas/Workspace'
 *       400:
 *         description: Invitation expired or already accepted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invitation not found
 *
 * /api/invites/{inviteId}:
 *   delete:
 *     summary: Revoke invitation
 *     description: Cancels a pending invitation (admin/owner only)
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Invitation revoked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Invitation not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
