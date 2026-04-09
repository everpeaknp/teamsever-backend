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
 *   name: "3. Project Hierarchy"
 *   description: "Space invitation management"
 */

// Space-scoped routes (requires spaceId)
const spaceInvitationRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/spaces/{spaceId}/invitations:
 *   post:
 *     summary: Send space invitation
 *     description: Invite a user to join a space
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get space invitations
 *     description: Retrieve all pending invitations for a space
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceInvitationRouter.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), sendSpaceInvitation);
spaceInvitationRouter.get("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), getSpaceInvitations);

/**
 * @swagger
 * /api/spaces/{spaceId}/invitations/{invitationId}:
 *   delete:
 *     summary: Cancel space invitation
 *     description: Cancel a pending space invitation
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Invitation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     tags: ["3. Project Hierarchy"]
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
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Invalid or expired invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
invitationRouter.post("/accept/:token", protect, acceptSpaceInvitation);

/**
 * @swagger
 * /api/space-invitations/decline/{token}:
 *   post:
 *     summary: Decline space invitation
 *     description: Decline a space invitation using token
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Invalid or expired invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
invitationRouter.post("/decline/:token", protect, declineSpaceInvitation);

/**
 * @swagger
 * /api/space-invitations/my-invitations:
 *   get:
 *     summary: Get my space invitations
 *     description: Retrieve all pending space invitations for current user
 *     tags: ["3. Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
invitationRouter.get("/my-invitations", protect, getMySpaceInvitations);

module.exports = { spaceInvitationRouter, invitationRouter };

export {};
