const express = require("express");
const {
  getTasksSummary,
  getWorkload,
  getStatusBreakdown
} = require("../controllers/dashboardController");
const { protect } = require("../middlewares/authMiddleware");

const dashboardRouter = express.Router();

// ============================================================
// ⚠️  ALL THREE ENDPOINTS BELOW ARE DEPRECATED
// USE INSTEAD: GET /api/workspaces/{id}/analytics
// That single endpoint returns tasks summary, workload, and
// status breakdown — plus hierarchy, members, announcements,
// and an active timer — all in one fast call.
// ============================================================

/**
 * @swagger
 * /api/dashboard/tasks/summary:
 *   get:
 *     summary: "[DEPRECATED] Get tasks summary"
 *     description: "**DEPRECATED.** Use `GET /api/workspaces/{id}/analytics` instead — it includes task counts and completion rate in the `stats` field."
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tasks summary
 *         content:
 *           application/json:
 *             example:
 *               totalTasks: 120
 *               completedTasks: 74
 *               completionRate: 61.7
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/tasks/summary", protect, getTasksSummary);

/**
 * @swagger
 * /api/dashboard/workload:
 *   get:
 *     summary: "[DEPRECATED] Get workload"
 *     description: "**DEPRECATED.** Use `GET /api/workspaces/{id}/analytics` instead — workload per member is available via `GET /api/analytics/workload?workspaceId=`."
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workload distribution
 *         content:
 *           application/json:
 *             example:
 *               - userId: "69bce50b96fe109fe4e14ff6"
 *                 userName: "Alice"
 *                 openTasks: 8
 *                 inProgressTasks: 3
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/workload", protect, getWorkload);

/**
 * @swagger
 * /api/dashboard/status-breakdown:
 *   get:
 *     summary: "[DEPRECATED] Get status breakdown"
 *     description: "**DEPRECATED.** Use `GET /api/workspaces/{id}/analytics` instead — status distribution is in the `stats.statusDistribution` field."
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task status breakdown
 *         content:
 *           application/json:
 *             example:
 *               - label: "Todo"
 *                 value: 35
 *               - label: "In Progress"
 *                 value: 22
 *               - label: "Done"
 *                 value: 63
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/status-breakdown", protect, getStatusBreakdown);

module.exports = dashboardRouter;

export {};
