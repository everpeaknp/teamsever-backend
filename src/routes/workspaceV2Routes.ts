const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const {
  getWorkspaceAnalyticsV2,
  getWorkspaceAnalyticsV2Details,
  getWorkspaceAnalyticsV2CompletionTrend,
  getWorkspaceAnalyticsV2TeamPerformance,
  getWorkspaceAnalyticsV2Activity,
  getWorkspaceAnalyticsV2Announcements
} = require("../controllers/workspaceController");

const router = express.Router();

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics:
 *   get:
 *     summary: Get workspace analytics summary (V2)
 *     description: Fast summary payload for dashboards. Use this for first paint, top cards, task-status counts, priority counts, time tracking summary, and team availability summary.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [workspace, personal]
 *         description: Scope of analytics. Personal is returned when the user lacks workspace analytics permission.
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Inclusive start date in YYYY-MM-DD format.
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Inclusive end date in YYYY-MM-DD format.
 *     responses:
 *       200:
 *         description: Workspace analytics summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AnalyticsV2SummaryResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Missing analytics permission
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
router.get("/:workspaceId/analytics", protect, requirePermission("VIEW_ANALYTICS_PERSONAL"), getWorkspaceAnalyticsV2);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics/details:
 *   get:
 *     summary: Get workspace analytics details (V2)
 *     description: Heavy dashboard payload with full tasks, hierarchy, members, announcements, activity, sticky notes, and performance. Use this only for sections that need the full data set.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [workspace, personal]
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Workspace analytics details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AnalyticsV2DetailsResponse"
 */
router.get(
  "/:workspaceId/analytics/details",
  protect,
  requirePermission("VIEW_ANALYTICS_PERSONAL"),
  getWorkspaceAnalyticsV2Details
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics/completion-trend:
 *   get:
 *     summary: Get completion trend chart data (V2)
 *     description: Lightweight chart-only payload for the completion trend widget. Use this instead of waiting for analytics details.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [workspace, personal]
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Completion trend retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AnalyticsV2TrendResponse"
 */
router.get(
  "/:workspaceId/analytics/completion-trend",
  protect,
  requirePermission("VIEW_ANALYTICS_PERSONAL"),
  getWorkspaceAnalyticsV2CompletionTrend
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics/team-performance:
 *   get:
 *     summary: Get team performance data (V2)
 *     description: Paginated, sortable team performance rows for the analytics table.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [workspace, personal]
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         required: false
 *         schema:
 *           type: string
 *           default: totalTasksFinished
 *       - in: query
 *         name: order
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Team performance retrieved successfully
 */
router.get(
  "/:workspaceId/analytics/team-performance",
  protect,
  requirePermission("VIEW_ANALYTICS_TEAM"),
  getWorkspaceAnalyticsV2TeamPerformance
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics/activity:
 *   get:
 *     summary: Get analytics activity feed (V2)
 *     description: Paginated activity feed for the dashboard activity panel.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [workspace, personal]
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Activity retrieved successfully
 */
router.get(
  "/:workspaceId/analytics/activity",
  protect,
  requirePermission("VIEW_ANALYTICS_PERSONAL"),
  getWorkspaceAnalyticsV2Activity
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/analytics/announcements:
 *   get:
 *     summary: Get analytics announcements (V2)
 *     description: Paginated announcements panel data for the dashboard.
 *     tags: ["0.1 ⭐ Primary Dashboard V2"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Announcements retrieved successfully
 */
router.get(
  "/:workspaceId/analytics/announcements",
  protect,
  requirePermission("VIEW_ANNOUNCEMENT"),
  getWorkspaceAnalyticsV2Announcements
);

module.exports = router;

export {};
