const express = require("express");
const {
  getTasksSummary,
  getWorkload,
  getStatusBreakdown
} = require("../controllers/dashboardController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard statistics and summaries
 */

const dashboardRouter = express.Router();

/**
 * @swagger
 * /api/dashboard/tasks/summary:
 *   get:
 *     summary: Get tasks summary
 *     description: Retrieve summary of user's tasks across all workspaces
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tasks summary retrieved successfully
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/tasks/summary", protect, getTasksSummary);

/**
 * @swagger
 * /api/dashboard/workload:
 *   get:
 *     summary: Get workload
 *     description: Retrieve user's workload distribution
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workload retrieved successfully
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/workload", protect, getWorkload);

/**
 * @swagger
 * /api/dashboard/status-breakdown:
 *   get:
 *     summary: Get status breakdown
 *     description: Retrieve breakdown of tasks by status
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status breakdown retrieved successfully
 *       401:
 *         description: Authentication required
 */
dashboardRouter.get("/status-breakdown", protect, getStatusBreakdown);

module.exports = dashboardRouter;

export {};
