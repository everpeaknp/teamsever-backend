const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceAnalytics,
  updateMemberCustomRole,
  getWorkspaceHierarchy,
  uploadLogo
} = require("../controllers/workspaceController");
const {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement
} = require("../controllers/announcementController");
const { toggleWorkspaceClock } = require("../controllers/workspaceMemberController");
const { protect } = require("../middlewares/authMiddleware");
const { checkWorkspaceLimit } = require("../middlewares/subscriptionMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const requireWorkspaceOwner = require("../middlewares/requireWorkspaceOwner");

/**
 * @swagger
 * tags:
 *   name: Workspaces
 *   description: Workspace management and member operations
 */

const router = express.Router();

// Rate limiter for custom role updates (10 requests per minute)
const customRoleRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: "Too many custom role updates, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

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
 *     responses:
 *       201:
 *         description: Workspace created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Workspace limit reached
 *   get:
 *     summary: Get all user workspaces
 *     description: Returns all workspaces where the user is a member
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 *       401:
 *         description: Authentication required
 */
router.post("/", protect, checkWorkspaceLimit, createWorkspace);
router.get("/", protect, getMyWorkspaces);

/**
 * @swagger
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 *   put:
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
 *         description: Authentication required
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
 *         description: Authentication required
 *       403:
 *         description: Only owner can delete workspace
 *       404:
 *         description: Workspace not found
 */
router.get("/:id", protect, requirePermission("VIEW_WORKSPACE"), getWorkspace);
router.put("/:id", protect, requirePermission("UPDATE_WORKSPACE"), updateWorkspace);
router.delete("/:id", protect, requirePermission("DELETE_WORKSPACE"), deleteWorkspace);

/**
 * @swagger
 * /api/workspaces/{id}/hierarchy:
 *   get:
 *     summary: Get workspace hierarchy (optimized)
 *     description: Returns complete workspace structure (Spaces -> Folders -> Lists) with task counts in a single query
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
 *         description: Workspace hierarchy retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspaceId:
 *                       type: string
 *                     workspaceName:
 *                       type: string
 *                     spaces:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           folders:
 *                             type: array
 *                           lists:
 *                             type: array
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/:id/hierarchy", protect, requirePermission("VIEW_WORKSPACE"), getWorkspaceHierarchy);

/**
 * @swagger
 * /api/workspaces/{id}/analytics:
 *   get:
 *     summary: Get workspace analytics
 *     description: Retrieve analytics data for a workspace
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
 *         description: Analytics data retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/:id/analytics", protect, requirePermission("VIEW_WORKSPACE"), getWorkspaceAnalytics);

/**
 * @swagger
 * /api/workspaces/{id}/announcements:
 *   get:
 *     summary: Get workspace announcements
 *     description: Retrieve all announcements for a workspace
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
 *         description: Announcements retrieved successfully
 *       401:
 *         description: Authentication required
 *   post:
 *     summary: Create workspace announcement
 *     description: Create a new announcement for a workspace
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
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *       401:
 *         description: Authentication required
 */
router.get("/:id/announcements", protect, requirePermission("VIEW_WORKSPACE"), getAnnouncements);
router.post("/:id/announcements", protect, requirePermission("VIEW_WORKSPACE"), createAnnouncement);

/**
 * @swagger
 * /api/workspaces/{id}/announcements/{announcementId}:
 *   delete:
 *     summary: Delete workspace announcement
 *     description: Delete an announcement from a workspace
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
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: string
 *         description: Announcement ID
 *     responses:
 *       200:
 *         description: Announcement deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Announcement not found
 */
router.delete("/:id/announcements/:announcementId", protect, requirePermission("VIEW_WORKSPACE"), deleteAnnouncement);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/clock/toggle:
 *   post:
 *     summary: Toggle workspace clock
 *     description: Clock in or clock out of workspace
 *     tags: [Workspaces]
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
 *         description: Clock toggled successfully
 *       401:
 *         description: Authentication required
 */
router.post("/:workspaceId/clock/toggle", protect, requirePermission("VIEW_WORKSPACE"), toggleWorkspaceClock);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{memberId}/custom-role:
 *   patch:
 *     summary: Update member custom role
 *     description: Update custom role for a workspace member (Owner only)
 *     tags: [Workspaces]
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
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customRole
 *             properties:
 *               customRole:
 *                 type: string
 *     responses:
 *       200:
 *         description: Custom role updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Owner privileges required
 *       429:
 *         description: Rate limit exceeded
 */
router.patch(
  "/:workspaceId/members/:memberId/custom-role",
  protect,
  requireWorkspaceOwner,
  customRoleRateLimiter,
  updateMemberCustomRole
);

const { uploadSingle, handleUploadError } = require("../middlewares/uploadMiddleware");

/**
 * @swagger
 * /api/workspaces/{id}/logo:
 *   patch:
 *     summary: Upload workspace logo
 *     description: Upload a new logo for the workspace (Owner only)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Owner privileges required
 */
router.patch(
  "/:workspaceId/logo",
  protect,
  requireWorkspaceOwner,
  uploadSingle,
  handleUploadError,
  uploadLogo
);

module.exports = router;

export {};
