const express = require("express");
const {
  getFolderMembers,
  addFolderMember,
  updateFolderMember,
  removeFolderMember,
} = require("../controllers/folderMemberController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

/**
 * @swagger
 * tags:
 *   name: Folder Members
 *   description: Folder-level member permission management
 */

const router = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/folders/{folderId}/folder-members:
 *   get:
 *     summary: Get folder members
 *     description: Retrieve all folder members with their permission overrides
 *     tags: [Folder Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: Folder members retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Folder not found
 *   post:
 *     summary: Add folder member override
 *     description: Add or update folder-level permission override for a member
 *     tags: [Folder Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
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
 *         description: Folder member added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get("/", protect, requirePermission("VIEW_FOLDER"), getFolderMembers);
router.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), addFolderMember);

/**
 * @swagger
 * /api/folders/{folderId}/folder-members/{userId}:
 *   patch:
 *     summary: Update folder member permissions
 *     description: Update folder-level permission override for a member
 *     tags: [Folder Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
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
 *         description: Folder member updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder member not found
 *   delete:
 *     summary: Remove folder member override
 *     description: Remove folder-level permission override for a member
 *     tags: [Folder Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Folder member override removed successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder member not found
 */
router.patch("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), updateFolderMember);
router.delete("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), removeFolderMember);

module.exports = router;

export {};
