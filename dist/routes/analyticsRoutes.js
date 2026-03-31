"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const router = express.Router();
// All routes require authentication
router.use(protect);
// ============================================================
// NOTE TO FLUTTER DEVELOPER
// ============================================================
// The PRIMARY dashboard endpoint is NOT here. Use this instead:
//   GET /api/workspaces/{id}/analytics
// That single endpoint gives you EVERYTHING (stats, hierarchy,
// members, tasks, announcements, timer) in one fast call.
//
// The 3 endpoints below are for specific chart-only use cases
// when you need detailed time-series data for analytics screens.
// ============================================================
/**
 * @swagger
 * /api/analytics/velocity:
 *   get:
 *     summary: "📈 Velocity — How fast is your team?"
 *     description: |
 *       Returns the number of tasks completed per day over the last N days.
 *       Use this to draw a **line chart** showing team speed over time.
 *
 *       **When to use:** Analytics / Reports screen only.
 *       **Not needed for:** The main dashboard. Use `GET /api/workspaces/{id}/analytics` instead.
 *
 *       **Parameters:**
 *       - `workspaceId` (**required**) — The workspace to query
 *       - `days` (optional, default 30) — How many past days to include
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of past days to include (default 30)
 *     responses:
 *       200:
 *         description: Daily task completion counts
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - date: "2026-03-01"
 *                   count: 3
 *                 - date: "2026-03-02"
 *                   count: 0
 *                 - date: "2026-03-03"
 *                   count: 7
 *                 - date: "2026-03-04"
 *                   count: 5
 *                 - date: "2026-03-05"
 *                   count: 0
 *       400:
 *         description: workspaceId is required
 *       401:
 *         description: Unauthorized — Bearer token missing or invalid
 *       403:
 *         description: You do not have access to this workspace
 */
router.get("/velocity", requirePermission("VIEW_ANALYTICS"), analyticsController.getVelocity);
/**
 * @swagger
 * /api/analytics/lead-time:
 *   get:
 *     summary: "⏱️ Lead Time — How long do tasks take?"
 *     description: |
 *       Returns the **average number of days** from task creation to task completion.
 *       Lower is better. Use this on an analytics / performance screen.
 *
 *       **When to use:** Analytics / Reports screen only.
 *       **Not needed for:** The main dashboard.
 *
 *       **Parameters:**
 *       - `workspaceId` (**required**) — The workspace to query
 *       - `days` (optional, default 30) — Rolling window in days
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Rolling window in days (default 30)
 *     responses:
 *       200:
 *         description: Average lead time in days
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 averageLeadTime: 4.5
 *                 unit: "days"
 *                 taskCount: 42
 *       400:
 *         description: workspaceId is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No access to this workspace
 */
router.get("/lead-time", requirePermission("VIEW_ANALYTICS"), analyticsController.getLeadTime);
/**
 * @swagger
 * /api/analytics/burn-down:
 *   get:
 *     summary: "🔥 Burn-down — How much work is left?"
 *     description: |
 *       Returns a snapshot of tasks grouped by status (todo, in-progress, done).
 *       Use this to draw a **burn-down chart** or a **donut/pie chart** showing progress.
 *
 *       **Burn-down explained:** As tasks get completed, `todo` count goes down
 *       and `done` count goes up. The completion rate % tells you how close to "done" you are.
 *
 *       **When to use:** Analytics / Reports screen only.
 *       **Not needed for:** The main dashboard.
 *
 *       **Parameters:**
 *       - `workspaceId` (**required**) — The workspace to query
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Task status snapshot
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 156
 *                 completed: 89
 *                 inProgress: 32
 *                 todo: 35
 *                 completionRate: 57
 *       400:
 *         description: workspaceId is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: No access to this workspace
 */
router.get("/burn-down", requirePermission("VIEW_ANALYTICS"), analyticsController.getBurnDown);
module.exports = router;
