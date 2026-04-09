const express = require("express");
const router = express.Router();
const performanceController = require("../controllers/performanceController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Performance
 *   description: User and team performance metrics
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/performance/me/workspace/{workspaceId}:
 *   get:
 *     summary: Get my performance
 *     description: Retrieve current user's performance metrics
 *     tags: ["7. Time & Attendance"]
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
 *     tags: ["7. Time & Attendance"]
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
 *     tags: ["7. Time & Attendance"]
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
 *     tags: ["7. Time & Attendance"]
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

module.exports = router;
export {};
