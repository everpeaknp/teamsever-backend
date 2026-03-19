const express = require("express");
const {
  sendSpaceInvitation,
  getSpaceInvitations,
  acceptSpaceInvitation,
  declineSpaceInvitation,
  cancelSpaceInvitation,
  getMySpaceInvitations
} = require("../controllers/spaceInvitationController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

/**
 * @swagger
 * tags:
 *   name: Space Invitations
 *   description: Space invitation management
 */

// Space-scoped routes (requires spaceId)
const spaceInvitationRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/spaces/{spaceId}/invitations:
 *   post:
 *     summary: Send space invitation
 *     description: Invite a user to join a space
 *     tags: [Space Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
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
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *   get:
 *     summary: Get space invitations
 *     description: Retrieve all pending invitations for a space
 *     tags: [Space Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
spaceInvitationRouter.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), sendSpaceInvitation);
spaceInvitationRouter.get("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), getSpaceInvitations);

/**
 * @swagger
 * /api/spaces/{spaceId}/invitations/{invitationId}:
 *   delete:
 *     summary: Cancel space invitation
 *     description: Cancel a pending space invitation
 *     tags: [Space Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
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
spaceInvitationRouter.delete("/:invitationId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), cancelSpaceInvitation);

// Standalone routes (no spaceId required)
const invitationRouter = express.Router();

/**
 * @swagger
 * /api/space-invitations/accept/{token}:
 *   post:
 *     summary: Accept space invitation
 *     description: Accept a space invitation using token
 *     tags: [Space Invitations]
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Invalid or expired invitation
 */
invitationRouter.post("/accept/:token", protect, acceptSpaceInvitation);

/**
 * @swagger
 * /api/space-invitations/decline/{token}:
 *   post:
 *     summary: Decline space invitation
 *     description: Decline a space invitation using token
 *     tags: [Space Invitations]
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
 *         description: Invitation declined successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Invalid or expired invitation
 */
invitationRouter.post("/decline/:token", protect, declineSpaceInvitation);

/**
 * @swagger
 * /api/space-invitations/my-invitations:
 *   get:
 *     summary: Get my space invitations
 *     description: Retrieve all pending space invitations for current user
 *     tags: [Space Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *       401:
 *         description: Authentication required
 */
invitationRouter.get("/my-invitations", protect, getMySpaceInvitations);

module.exports = { spaceInvitationRouter, invitationRouter };

export {};
