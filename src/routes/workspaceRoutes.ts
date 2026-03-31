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
const stickyNoteController = require("../controllers/stickyNoteController");
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
 *     tags: ["Workspace Management"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/WorkspaceResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Workspace limit reached
 *   get:
 *     summary: Get all user workspaces
 *     description: Returns all workspaces where the user is a member, including member count and owner info.
 *     tags: ["Workspace Management"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/WorkspaceListResponse"
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
 *     description: Returns full workspace details including members, settings, and subscription status.
 *     tags: ["Workspace Management"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/WorkspaceResponse"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   put:
 *     summary: Update workspace
 *     description: Updates workspace properties (owner/admin only)
 *     tags: ["Workspace Management"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/WorkspaceResponse"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete workspace
 *     description: Deletes a workspace (owner only)
 *     tags: ["Workspace Management"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only owner can delete workspace
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     tags: ["Project Hierarchy"]
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
 *               $ref: "#/components/schemas/HierarchyResponse"
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
 *     summary: "🚀 PRIMARY DASHBOARD — Get All Workspace Data in One Call"
 *     description: |
 *       ## ⭐ Use This Endpoint for the Dashboard Screen
 *
 *       This is the **only endpoint** the Flutter app needs for the main workspace dashboard.
 *       It replaces ALL of these older/deprecated endpoints:
 *       - ~~`/api/analytics/workspace/{id}`~~ (deprecated)
 *       - ~~`/api/analytics/workspaces/{id}/summary`~~ (deprecated)
 *       - ~~`/api/analytics/workspaces/{id}/workload`~~ (deprecated)
 *
 *       **What you get in one call:**
 *       | Field | Description |
 *       |---|---|
 *       | `workspace` | Workspace name and details |
 *       | `stats` | Total tasks, completion rate, priority & status breakdown |
 *       | `hierarchy` | Full tree: Spaces → Folders → Lists |
 *       | `members` | Who is clocked in right now |
 *       | `tasks` | Recent tasks (top 100) |
 *       | `announcements` | Latest workspace announcements |
 *       | `currentRunningTimer` | The logged-in user's active timer (if any) |
 *       | `stickyNote` | The logged-in user's personal sticky note for this workspace |
 *       | `recentActivity` | Recent actions performed in this workspace |
 *       | `performance` | Performance metrics for the user (and team for admins) |
 *
 *       **Performance:** MongoDB `$facet` + `Promise.all` → sub-second response on mobile.
 *     tags: ["Dashboard & Analytics"]
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
 *         description: Consolidated analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AnalyticsResponse"
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
 *     description: Retrieve all active announcements for a specific workspace, ordered by creation date (newest first).
 *     tags: ["Collaboration"]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Announcement" }
 *       401:
 *         description: Authentication required
 *   post:
 *     summary: Create workspace announcement
 *     description: Create a new announcement that will be visible to all workspace members.
 *     tags: ["Collaboration"]
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
 *                 example: "System Maintenance"
 *               content:
 *                 type: string
 *                 example: "The system will be down for 2 hours this Sunday at midnight."
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data: { $ref: "#/components/schemas/Announcement" }
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions (Admins/Owners only)
 */
router.get("/:id/announcements", protect, requirePermission("VIEW_WORKSPACE"), getAnnouncements);
router.post("/:id/announcements", protect, requirePermission("VIEW_WORKSPACE"), createAnnouncement);

/**
 * @swagger
 * /api/workspaces/{id}/announcements/{announcementId}:
 *   delete:
 *     summary: Delete workspace announcement
 *     description: Delete an announcement from a workspace
 *     tags: ["Collaboration"]
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
 *     tags: ["Attendance & Reporting"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClockToggleResponse'
 *       401:
 *         description: Authentication required
 * /api/workspaces/{id}/sticky-note:
 *   patch:
 *     summary: Update personal sticky note
 *     description: Save the user's personal sticky note content for this workspace.
 *     tags: ["Productivity"]
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
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sticky note updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/StickyNoteResponse"
 *       401:
 *         description: Authentication required
 */
router.post("/:workspaceId/clock/toggle", protect, requirePermission("VIEW_WORKSPACE"), toggleWorkspaceClock);
router.patch("/:id/sticky-note", protect, requirePermission("VIEW_WORKSPACE"), stickyNoteController.updateStickyNote);
router.get("/:id/sticky-note", protect, requirePermission("VIEW_WORKSPACE"), stickyNoteController.getStickyNote);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{memberId}/custom-role:
 *   patch:
 *     summary: Update member custom role
 *     description: Update custom role for a workspace member (Owner only)
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
 *     tags: ["Workspace Management"]
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
