const express = require("express");
const {
  sendInvite,
  acceptInvite,
  redeemInvite,
  getWorkspaceInvitations,
  cancelInvitation,
  getMyInvitations,
  verifyInvitation
} = require("../controllers/invitationController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const validate = require("../utils/validation");
const { sendInviteSchema } = require("../validators/invitationValidators");

/**
 * @swagger
 * tags:
 *   name: "2.3 Workspaces — Invitations"
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
 *     tags: ["2.3 Workspaces — Invitations"]
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
 *               inviteType:
 *                 type: string
 *                 enum: [email, link]
 *                 default: email
 *               expiresInHours:
 *                 type: integer
 *                 description: Custom expiry duration in hours (e.g. 24, 168)
 *                 default: 168
 *               spaceId:
 *                 type: string
 *                 description: Optional space ID for auto-provisioning
 *               spacePermissionLevel:
 *                 type: string
 *                 enum: [FULL, EDIT, COMMENT, VIEW]
 *                 default: EDIT
 *     responses:
 *       201:
 *         description: Invitation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Invitation sent to email@example.com" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id: { type: "string" }
 *                     inviteType: { type: "string", enum: [email, link] }
 *                     spaceId: { type: "string", nullable: true }
 *                     spacePermissionLevel: { $ref: "#/components/schemas/PermissionLevel" }
 *                     expiresAt: { type: "string", format: "date-time" }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     summary: Get workspace invitations
 *     description: Returns all pending (not yet accepted or cancelled) invitations for a workspace.
 *     tags: ["2.3 Workspaces — Invitations"]
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
 *         description: Pending invitations retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Invitation" }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/", protect, requirePermission("INVITE_MEMBER"), validate(sendInviteSchema), sendInvite);
router.get("/", protect, requirePermission("INVITE_MEMBER"), getWorkspaceInvitations);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/invites/{invitationId}:
 *   delete:
 *     summary: Cancel invitation
 *     description: Cancels a pending invitation (admin/owner only)
 *     tags: ["2.3 Workspaces — Invitations"]
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
router.delete("/:invitationId", protect, requirePermission("INVITE_MEMBER"), cancelInvitation);

// Standalone invitation routes
const inviteRouter = express.Router();

/**
 * @swagger
 * /api/invites/accept/{token}:
 *   post:
 *     summary: Accept workspace invitation
 *     description: Accepts an invitation and adds the user to the workspace
 *     tags: ["2.3 Workspaces — Invitations"]
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
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Successfully joined Team Workspace" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       type: object
 *                       properties:
 *                         _id: { type: "string" }
 *                         name: { type: "string" }
 *                         description: { type: "string", nullable: true }
 *                     role: { type: "string" }
 *                     alreadyMember: { type: "boolean" }
 *                     spaceId: { type: "string", nullable: true }
 *                     spaceName: { type: "string", nullable: true }
 *                     spacePermissionLevel: { $ref: "#/components/schemas/PermissionLevel" }
 *       400:
 *         description: Invitation expired or already accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
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
inviteRouter.post("/accept/:token", protect, acceptInvite);

/**
 * @swagger
 * /api/invites/redeem:
 *   post:
 *     summary: Redeem invite by short code
 *     description: Join a workspace using a short human-friendly code (e.g. "A3BX9K2T"). Works identically to the link-based flow including fast-pass space provisioning.
 *     tags: ["2.3 Workspaces — Invitations"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "A3BX9K2T"
 *                 description: The 8-character invite code
 *     responses:
 *       200:
 *         description: Successfully joined workspace
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 message: { type: "string", example: "Successfully joined Team Workspace" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       type: object
 *                       properties:
 *                         _id: { type: "string" }
 *                         name: { type: "string" }
 *                         description: { type: "string", nullable: true }
 *                     role: { type: "string" }
 *                     alreadyMember: { type: "boolean" }
 *                     spaceId: { type: "string", nullable: true }
 *                     spaceName: { type: "string", nullable: true }
 *                     spacePermissionLevel: { $ref: "#/components/schemas/PermissionLevel" }
 *       400:
 *         description: Code is required
 *       404:
 *         description: Invalid or expired invite code
 */
inviteRouter.post("/redeem", protect, redeemInvite);

/**
 * @swagger
 * /api/invites/my-invitations:
 *   get:
 *     summary: Get my pending invitations
 *     description: Returns all workspace invitations sent to the current user that are still pending (not yet accepted or declined).
 *     tags: ["2.3 Workspaces — Invitations"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My invitations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Invitation" }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     tags: ["2.3 Workspaces — Invitations"]
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
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace: { type: "object", properties: { name: { type: "string" } } }
 *                     invitedBy: { type: "string" }
 *                     role: { type: "string" }
 *       404:
 *         description: Invitation not found or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
publicInviteRouter.get("/verify/:token", verifyInvitation);

module.exports = { workspaceInvitationRouter: router, inviteRouter, publicInviteRouter };

export {};
