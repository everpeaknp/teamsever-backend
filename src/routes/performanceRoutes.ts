const express = require("express");
const router = express.Router();
const performanceController = require("../controllers/performanceController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/performance/me/workspace/{workspaceId}:
 *   get:
 *     summary: Get my performance
 *     description: Retrieve current user's performance metrics
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive start date (YYYY-MM-DD).
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive end date (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/me/workspace/:workspaceId", requirePermission("VIEW_ANALYTICS_PERSONAL"), performanceController.getMyPerformance);

/**
 * @swagger
 * /api/performance/user/{userId}/workspace/{workspaceId}:
 *   get:
 *     summary: Get user performance
 *     description: Retrieve specific user's performance metrics
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/user/:userId/workspace/:workspaceId", requirePermission("VIEW_ANALYTICS_TEAM"), performanceController.getUserPerformance);

/**
 * @swagger
 * /api/performance/user/{userId}/workspace/{workspaceId}/details:
 *   get:
 *     summary: Get detailed user performance
 *     description: Retrieve specific user's detailed performance metrics and task history
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Max task-history rows to return.
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive start date (YYYY-MM-DD).
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive end date (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Detailed performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/user/:userId/workspace/:workspaceId/details", requirePermission("VIEW_ANALYTICS_TEAM"), performanceController.getUserPerformanceDetails);

/**
 * @swagger
 * /api/performance/team/workspace/{workspaceId}:
 *   get:
 *     summary: Get team performance
 *     description: Retrieve team performance metrics
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive start date (YYYY-MM-DD).
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional inclusive end date (YYYY-MM-DD).
 *     responses:
 *       200:
 *         description: Team performance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/PerformanceResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/team/workspace/:workspaceId", requirePermission("VIEW_ANALYTICS_TEAM"), performanceController.getTeamPerformance);

/**
 * @swagger
 * /api/performance/workspace/{workspaceId}/summary:
 *   get:
 *     summary: Get workspace performance summary
 *     description: Retrieve workspace performance summary
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Performance summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/PerformanceResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/workspace/:workspaceId/summary", requirePermission("VIEW_ANALYTICS_TEAM"), performanceController.getWorkspacePerformanceSummary);

// Contribution & Streak routes
const contributionController = require("../controllers/contributionController");

/**
 * @swagger
 * /api/performance/contributions/me:
 *   get:
 *     summary: Get my contributions & streaks
 *     description: Retrieve current user's daily contributions and streak statistics.
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional workspace filter
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, commits, tasks]
 *           default: all
 *         description: Type of contributions
 *     responses:
 *       200:
 *         description: Contributions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/contributions/me", contributionController.getMyContributions);

/**
 * @swagger
 * /api/performance/contributions/{userId}:
 *   get:
 *     summary: Get user contributions & streaks
 *     description: Retrieve specific user's daily contributions and streak statistics.
 *     tags: ["7.4 Time — Performance Metrics"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: workspaceId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional workspace filter
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, commits, tasks]
 *           default: all
 *         description: Type of contributions
 *     responses:
 *       200:
 *         description: Contributions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Missing user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/contributions/:userId", contributionController.getUserContributions);

module.exports = router;
export {};
