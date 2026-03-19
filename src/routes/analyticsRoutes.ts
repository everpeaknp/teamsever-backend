const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/analytics/workspaces/{workspaceId}/summary:
 *   get:
 *     summary: Get workspace analytics summary
 *     description: |
 *       Comprehensive workspace analytics using MongoDB aggregation pipelines.
 *       
 *       **Metrics Included:**
 *       - Total tasks and completion rate
 *       - Priority distribution (low, medium, high, urgent)
 *       - Status distribution (todo, in-progress, done)
 *       - Velocity: Tasks completed per day (last 14 days)
 *       - Lead time: Average days from creation to completion
 *       
 *       **Data Format:**
 *       All distributions are formatted for chart libraries (Recharts, Chart.js):
 *       ```json
 *       [{ label: "High", value: 15 }, { label: "Medium", value: 30 }]
 *       ```
 *     tags: [Analytics]
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
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsSummary'
 *             example:
 *               totalTasks: 150
 *               completedTasks: 95
 *               completionRate: 63.33
 *               priorityDistribution:
 *                 - label: "Low"
 *                   value: 30
 *                 - label: "Medium"
 *                   value: 60
 *                 - label: "High"
 *                   value: 45
 *                 - label: "Urgent"
 *                   value: 15
 *               statusDistribution:
 *                 - label: "Todo"
 *                   value: 40
 *                 - label: "In Progress"
 *                   value: 15
 *                 - label: "Done"
 *                   value: 95
 *               velocity:
 *                 - date: "2026-02-03"
 *                   completed: 5
 *                 - date: "2026-02-04"
 *                   completed: 8
 *               leadTime: 4.5
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.get("/workspaces/:workspaceId/summary", requirePermission("VIEW_ANALYTICS"), analyticsController.getWorkspaceOverview);

/**
 * @swagger
 * /api/analytics/workspaces/{workspaceId}/workload:
 *   get:
 *     summary: Get team workload distribution
 *     description: |
 *       Shows task distribution across team members using MongoDB $lookup aggregation.
 *       
 *       **Metrics per User:**
 *       - Open tasks (status: todo)
 *       - In-progress tasks
 *       - Total assigned tasks
 *       - User details (name, email)
 *       
 *       **Use Case:** Identify overloaded team members and balance workload
 *     tags: [Analytics]
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
 *         description: Team workload data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                     description: User ID
 *                   userName:
 *                     type: string
 *                     description: User's full name
 *                   userEmail:
 *                     type: string
 *                     description: User's email
 *                   openTasks:
 *                     type: number
 *                     description: Number of todo tasks
 *                   inProgressTasks:
 *                     type: number
 *                     description: Number of in-progress tasks
 *                   totalAssignedTasks:
 *                     type: number
 *                     description: Total tasks assigned
 *             example:
 *               - userId: "507f1f77bcf86cd799439011"
 *                 userName: "John Doe"
 *                 userEmail: "john@example.com"
 *                 openTasks: 12
 *                 inProgressTasks: 5
 *                 totalAssignedTasks: 17
 *               - userId: "507f1f77bcf86cd799439012"
 *                 userName: "Jane Smith"
 *                 userEmail: "jane@example.com"
 *                 openTasks: 8
 *                 inProgressTasks: 3
 *                 totalAssignedTasks: 11
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.get("/workspaces/:workspaceId/workload", requirePermission("VIEW_ANALYTICS"), analyticsController.getTeamWorkload);

/**
 * @swagger
 * /api/analytics/velocity:
 *   get:
 *     summary: Get velocity metrics
 *     description: Tasks completed per day for trend analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Velocity data
 *       401:
 *         description: Unauthorized
 */
router.get("/velocity", requirePermission("VIEW_ANALYTICS"), analyticsController.getVelocity);

/**
 * @swagger
 * /api/analytics/lead-time:
 *   get:
 *     summary: Get lead time metrics
 *     description: Average time from task creation to completion
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lead time data
 *       401:
 *         description: Unauthorized
 */
router.get("/lead-time", requirePermission("VIEW_ANALYTICS"), analyticsController.getLeadTime);

/**
 * @swagger
 * /api/analytics/burn-down:
 *   get:
 *     summary: Get burn-down chart data
 *     description: Open vs completed tasks over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Burn-down data
 *       401:
 *         description: Unauthorized
 */
router.get("/burn-down", requirePermission("VIEW_ANALYTICS"), analyticsController.getBurnDown);

/**
 * @swagger
 * /api/analytics/workspace/{workspaceId}:
 *   get:
 *     summary: Get comprehensive workspace analytics
 *     description: All analytics metrics in a single response
 *     tags: [Analytics]
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
 *         description: Complete analytics data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 */
router.get("/workspace/:workspaceId", requirePermission("VIEW_ANALYTICS"), analyticsController.getWorkspaceAnalytics);

module.exports = router;

export {};
