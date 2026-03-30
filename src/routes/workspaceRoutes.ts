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
 *     description: Returns all workspaces where the user is a member, including member count and owner info.
 *     tags: [Workspaces]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f716752bb"
 *                   name: "Engineering Team"
 *                   logo: null
 *                   createdBy: "69bce50b96fe109fe4e14ff6"
 *                   memberCount: 5
 *                   myRole: "owner"
 *                   createdAt: "2026-01-15T08:00:00Z"
 *                 - _id: "69bbf827a96fe78f716752cc"
 *                   name: "Design Squad"
 *                   logo: "https://res.cloudinary.com/example/image/upload/logo.png"
 *                   createdBy: "69bcc46789cab60dfa454499"
 *                   memberCount: 3
 *                   myRole: "member"
 *                   createdAt: "2026-02-01T10:00:00Z"
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f716752bb"
 *                 name: "Engineering Team"
 *                 logo: null
 *                 createdBy:
 *                   _id: "69bce50b96fe109fe4e14ff6"
 *                   name: "Alice Smith"
 *                   email: "alice@example.com"
 *                 members:
 *                   - user:
 *                       _id: "69bce50b96fe109fe4e14ff6"
 *                       name: "Alice Smith"
 *                     role: "owner"
 *                     isClockedIn: true
 *                   - user:
 *                       _id: "69bcc46789cab60dfa454499"
 *                       name: "Bob Jones"
 *                     role: "member"
 *                     isClockedIn: false
 *                 settings:
 *                   defaultTimezone: "Asia/Kathmandu"
 *                 createdAt: "2026-01-15T08:00:00Z"
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
 *       | `tasks` | Recent tasks |
 *       | `announcements` | Latest workspace announcements |
 *       | `currentRunningTimer` | The logged-in user's active timer (if any) |
 *
 *       **Performance:** MongoDB `$facet` + `Promise.all` → sub-second response on mobile.
 *     tags: [Analytics, Workspaces]
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       type: object
 *                     stats:
 *                       type: object
 *                     hierarchy:
 *                       type: array
 *                     members:
 *                       type: array
 *                     tasks:
 *                       type: array
 *                     announcements:
 *                       type: array
 *                     currentRunningTimer:
 *                       type: object
 *             example:
 *               success: true
 *               data:
 *                 workspace:
 *                   _id: "69bbf827a96fe78f716752bb"
 *                   name: "Engineering Team"
 *                 stats:
 *                   totalTasks: 156
 *                   completedTasks: 89
 *                   completionRate: 57
 *                   priorityDistribution:
 *                     - label: "High"
 *                       value: 12
 *                     - label: "Urgent"
 *                       value: 5
 *                 hierarchy:
 *                   - _id: "69bbf827a96fe78f716753c1"
 *                     name: "Backend API"
 *                     folders: []
 *                     lists:
 *                       - _id: "69bbf827a96fe78f716753d2"
 *                         name: "Sprint 5"
 *                         taskCount: 24
 *                 members:
 *                   - _id: "69bbf827a96fe78f716754e3"
 *                     name: "Alice Smith"
 *                     isClockedIn: true
 *                     lastClockIn: "2026-03-30T01:00:00Z"
 *                 tasks:
 *                   - _id: "69bbf827a96fe78f716755f4"
 *                     title: "Implement OAuth2"
 *                     status: "in-progress"
 *                     priority: "high"
 *                 announcements:
 *                   - _id: "69bbf827a96fe78f71675605"
 *                     title: "Server Migration"
 *                     content: "Scheduled for Friday midnight."
 *                 currentRunningTimer:
 *                   _id: "69bbf827a96fe78f71675716"
 *                   taskTitle: "API Documentation"
 *                   startTime: "2026-03-30T01:30:00Z"
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675601"
 *                   title: "Welcome to our new Workspace!"
 *                   content: "Feel free to explore and add your first task."
 *                   author: "69bce50b96fe109fe4e14ff6"
 *                   createdAt: "2026-03-30T08:00:00Z"
 *       401:
 *         description: Authentication required
 *   post:
 *     summary: Create workspace announcement
 *     description: Create a new announcement that will be visible to all workspace members.
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
 *                 example: "System Maintenance"
 *               content:
 *                 type: string
 *                 example: "The system will be down for 2 hours this Sunday at midnight."
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f71675602"
 *                 title: "System Maintenance"
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
