const express = require("express");
const {
  getWorkspaceMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  updateMyStatus,
} = require("../controllers/memberController");
const { protect } = require("../middlewares/authMiddleware");
const { checkMemberLimit } = require("../middlewares/subscriptionMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members:
 *   get:
 *     summary: Get workspace members
 *     description: Returns all members of a workspace with their roles and status.
 *     tags: ["Workspace Management"]
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
 *         description: Members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/MemberListResponse"
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
router.get("/", protect, requirePermission("VIEW_WORKSPACE"), getWorkspaceMembers);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/invite:
 *   post:
 *     summary: Invite member directly
 *     description: Adds an existing user to the workspace by email (skips invitation link). Use the Invitations endpoints for external users.
 *     tags: ["Workspace Management"]
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
 *                 example: "newuser@example.com"
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *                 default: member
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Email already a member or not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Member limit reached or insufficient permissions
 */
router.post("/invite", protect, checkMemberLimit, requirePermission("INVITE_MEMBER"), inviteMember);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/me/status:
 *   patch:
 *     summary: Update my status
 *     description: Update the current user's status label within the workspace (e.g. "In a meeting", "Focus mode").
 *     tags: ["Workspace Management"]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: "In a meeting"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 */
router.patch("/me/status", protect, requirePermission("VIEW_WORKSPACE"), updateMyStatus);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{userId}:
 *   patch:
 *     summary: Update member role
 *     description: Change a member's role (Admin/Owner only).
 *     tags: ["Workspace Management"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member to update
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
 *                 enum: [member, admin]
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 *   delete:
 *     summary: Remove member
 *     description: Remove a member from the workspace (Owner only).
 *     tags: ["Workspace Management"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID of the member to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 */
router.patch("/:userId", protect, requirePermission("CHANGE_MEMBER_ROLE"), updateMemberRole);
router.delete("/:userId", protect, requirePermission("REMOVE_MEMBER"), require("../middlewares/ownerOnly"), removeMember);

module.exports = router;

export {};
