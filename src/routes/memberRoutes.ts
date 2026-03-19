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

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Workspace member management
 */

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members:
 *   get:
 *     summary: Get workspace members
 *     description: Retrieve all members of a workspace
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
 *         description: Members retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/", protect, requirePermission("VIEW_WORKSPACE"), getWorkspaceMembers);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/invite:
 *   post:
 *     summary: Invite member
 *     description: Invite a new member to the workspace
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
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       400:
 *         description: Validation error
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
 *     description: Update current user's status in workspace
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
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       401:
 *         description: Authentication required
 */
router.patch("/me/status", protect, requirePermission("VIEW_WORKSPACE"), updateMyStatus);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{userId}:
 *   patch:
 *     summary: Update member role
 *     description: Update a member's role in the workspace
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
 *                 enum: [member, admin, owner]
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Member not found
 *   delete:
 *     summary: Remove member
 *     description: Remove a member from the workspace
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
 *     responses:
 *       200:
 *         description: Member removed successfully
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
