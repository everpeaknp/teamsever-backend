"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Activity tracking and comments management
 */
/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get activities
 *     description: Retrieve activity logs with filtering options
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filter by workspace
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *         description: Filter by task
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/activities", protect, activityController.getActivities);
/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   post:
 *     summary: Create comment on task
 *     description: Add a new comment to a task
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
router.post("/tasks/:taskId/comments", protect, activityController.createComment);
/**
 * @swagger
 * /api/tasks/{taskId}/activity:
 *   get:
 *     summary: Get task activity
 *     description: Retrieve all activity logs for a specific task
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task activity retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
router.get("/tasks/:taskId/activity", protect, activityController.getTaskActivity);
/**
 * @swagger
 * /api/activities/{activityId}:
 *   put:
 *     summary: Update comment
 *     description: Edit an existing comment
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to update this comment
 *       404:
 *         description: Comment not found
 *   delete:
 *     summary: Delete comment
 *     description: Remove a comment from a task
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 */
router.put("/activities/:activityId", protect, activityController.updateComment);
router.delete("/activities/:activityId", protect, activityController.deleteComment);
/**
 * @swagger
 * /api/activities/{activityId}/reactions:
 *   post:
 *     summary: Add reaction to comment
 *     description: Add an emoji reaction to a comment
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction added successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 *   delete:
 *     summary: Remove reaction from comment
 *     description: Remove an emoji reaction from a comment
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reaction removed successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 */
router.post("/activities/:activityId/reactions", protect, activityController.addReaction);
router.delete("/activities/:activityId/reactions", protect, activityController.removeReaction);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/activity:
 *   get:
 *     summary: Get workspace activity feed
 *     description: Retrieve activity feed for a workspace
 *     tags: [Activity]
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
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Workspace activity retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/workspaces/:workspaceId/activity", protect, activityController.getUserActivity);
module.exports = router;
