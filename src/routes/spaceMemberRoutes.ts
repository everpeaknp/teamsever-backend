const express = require("express");
const {
  getSpaceMembers,
  addSpaceMember,
  updateSpaceMember,
  removeSpaceMember,
} = require("../controllers/spaceMemberController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

/**
 * @swagger
 * tags:
 *   name: Space Members
 *   description: Space-level member permission management
 */

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/spaces/{spaceId}/space-members:
 *   get:
 *     summary: Get space members
 *     description: Retrieve all space members with their permission overrides
 *     tags: [Space Members]
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
 *         description: Space members retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Space not found
 *   post:
 *     summary: Add space member override
 *     description: Add or update space-level permission override for a member
 *     tags: [Space Members]
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
 *               - userId
 *               - permissions
 *             properties:
 *               userId:
 *                 type: string
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Space member added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get("/", protect, requirePermission("VIEW_SPACE"), getSpaceMembers);
router.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), addSpaceMember);

/**
 * @swagger
 * /api/spaces/{spaceId}/space-members/{userId}:
 *   patch:
 *     summary: Update space member permissions
 *     description: Update space-level permission override for a member
 *     tags: [Space Members]
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
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Space member updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space member not found
 *   delete:
 *     summary: Remove space member override
 *     description: Remove space-level permission override for a member
 *     tags: [Space Members]
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
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Space member override removed successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space member not found
 */
router.patch("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), updateSpaceMember);
router.delete("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), removeSpaceMember);

module.exports = router;

export {};
