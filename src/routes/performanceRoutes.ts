const express = require("express");
const router = express.Router();
const performanceController = require("../controllers/performanceController");
const { protect } = require("../middlewares/authMiddleware");

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
router.get("/me/workspace/:workspaceId", performanceController.getMyPerformance);

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
router.get("/user/:userId/workspace/:workspaceId", performanceController.getUserPerformance);

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
router.get("/team/workspace/:workspaceId", performanceController.getTeamPerformance);

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
router.get("/workspace/:workspaceId/summary", performanceController.getWorkspacePerformanceSummary);

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
