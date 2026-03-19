"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { sendInvite, acceptInvite, getWorkspaceInvitations, cancelInvitation, getMyInvitations, verifyInvitation } = require("../controllers/invitationController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const validate = require("../utils/validation");
const { sendInviteSchema } = require("../validators/invitationValidators");
/**
 * @swagger
 * tags:
 *   name: Invitations
 *   description: Workspace invitation system
 */
const router = express.Router({ mergeParams: true });
// Workspace-scoped invitation routes
/**
 * @swagger
 * /api/workspaces/{workspaceId}/invites:
 *   post:
 *     summary: Send workspace invitation
 *     description: Create an invitation link for a workspace
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
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *   get:
 *     summary: Get workspace invitations
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.post("/", protect, requirePermission("INVITE_MEMBER"), validate(sendInviteSchema), sendInvite);
router.get("/", protect, requirePermission("INVITE_MEMBER"), getWorkspaceInvitations);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/invites/{invitationId}:
 *   delete:
 *     summary: Cancel invitation
 *     description: Cancels a pending invitation (admin/owner only)
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
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Invitation cancelled successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Invitation not found
 */
router.delete("/:invitationId", protect, requirePermission("INVITE_MEMBER"), cancelInvitation);
// Standalone invitation routes
const inviteRouter = express.Router();
/**
 * @swagger
 * /api/invites/accept/{token}:
 *   post:
 *     summary: Accept workspace invitation
 *     description: Accepts an invitation and adds the user to the workspace
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
 *       400:
 *         description: Invitation expired or already accepted
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Invitation not found
 */
inviteRouter.post("/accept/:token", protect, acceptInvite);
/**
 * @swagger
 * /api/invites/my-invitations:
 *   get:
 *     summary: Get my invitations
 *     description: Retrieve all pending invitations for current user
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *       401:
 *         description: Authentication required
 */
inviteRouter.get("/my-invitations", protect, getMyInvitations);
// Public routes (no authentication required)
const publicInviteRouter = express.Router();
/**
 * @swagger
 * /api/invites/verify/{token}:
 *   get:
 *     summary: Verify invitation token
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
 *       404:
 *         description: Invitation not found or expired
 */
publicInviteRouter.get("/verify/:token", verifyInvitation);
module.exports = { workspaceInvitationRouter: router, inviteRouter, publicInviteRouter };
