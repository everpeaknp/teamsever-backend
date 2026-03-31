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
 *   description: Task comments, emoji reactions, and audit activity feed. All task interactions are stored as activity entries.
 */
/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get activity logs
 *     description: |
 *       Retrieve activity logs with optional filters.
 *       **Access Control:** Owners/Admins see all workspace activity; regular members see only their own logs.
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
 *         description: Filter by specific task
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Activities retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675900"
 *                   type: "task_created"
 *                   action: "created task"
 *                   performedBy:
 *                     _id: "69bce50b96fe109fe4e14ff6"
 *                     name: "Alice Smith"
 *                   task:
 *                     _id: "69bbf827a96fe78f716755f4"
 *                     title: "Implement OAuth2"
 *                   workspace: "69bbf827a96fe78f716752bb"
 *                   createdAt: "2026-03-30T08:00:00Z"
 *                 - _id: "69bbf827a96fe78f71675901"
 *                   type: "comment"
 *                   action: "commented"
 *                   content: "Great progress! Let's merge this."
 *                   performedBy:
 *                     _id: "69bcc46789cab60dfa454499"
 *                     name: "Bob Jones"
 *                   task:
 *                     _id: "69bbf827a96fe78f716755f4"
 *                     title: "Implement OAuth2"
 *                   workspace: "69bbf827a96fe78f716752bb"
 *                   createdAt: "2026-03-30T09:15:00Z"
 *       401:
 *         description: Authentication required
 */
router.get("/activities", protect, activityController.getActivities);
/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   post:
 *     summary: Add comment to task
 *     description: Post a new comment on a task. Supports @mentions by including user IDs in the `mentions` array.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: "Great work! Can we also handle the edge case?"
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["69bce50b96fe109fe4e14ff6"]
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f71675902"
 *                 type: "comment"
 *                 content: "Great work! Can we also handle the edge case?"
 *                 performedBy:
 *                   _id: "69bce50b96fe109fe4e14ff6"
 *                   name: "Alice Smith"
 *                 reactions: []
 *                 createdAt: "2026-03-30T10:00:00Z"
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
 *     summary: Get task activity feed
 *     description: Returns all activity (comments, status changes, assignments) for a specific task, newest first.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task activity retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675902"
 *                   type: "comment"
 *                   content: "Can we add unit tests here?"
 *                   performedBy:
 *                     _id: "69bce50b96fe109fe4e14ff6"
 *                     name: "Alice Smith"
 *                   reactions:
 *                     - emoji: "👍"
 *                       user: "69bcc46789cab60dfa454499"
 *                   createdAt: "2026-03-30T09:00:00Z"
 *                 - _id: "69bbf827a96fe78f71675903"
 *                   type: "status_changed"
 *                   action: "changed status from todo to in-progress"
 *                   performedBy:
 *                     _id: "69bcc46789cab60dfa454499"
 *                     name: "Bob Jones"
 *                   createdAt: "2026-03-29T14:00:00Z"
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
 *     summary: Edit comment
 *     description: Edit an existing comment. Only the comment author can edit it.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Comment updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Comment updated"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only the comment author can edit
 *       404:
 *         description: Comment not found
 *   delete:
 *     summary: Delete comment
 *     description: Delete a comment. Author or workspace admin can delete.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Comment deleted"
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Comment not found
 */
router.put("/activities/:activityId", protect, activityController.updateComment);
router.delete("/activities/:activityId", protect, activityController.deleteComment);
/**
 * @swagger
 * /api/activities/{activityId}/reactions:
 *   post:
 *     summary: Add emoji reaction
 *     description: Add an emoji reaction to a comment. If the same emoji already exists from the user, it toggles off.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction added
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Reaction added"
 *       401:
 *         description: Authentication required
 *   delete:
 *     summary: Remove emoji reaction
 *     description: Remove your emoji reaction from a comment.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction removed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Reaction removed"
 *       401:
 *         description: Authentication required
 */
router.post("/activities/:activityId/reactions", protect, activityController.addReaction);
router.delete("/activities/:activityId/reactions", protect, activityController.removeReaction);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/activity:
 *   get:
 *     summary: Get workspace activity feed
 *     description: |
 *       Returns activity logs for the entire workspace.
 *       **Access Control:**
 *       - **Owners/Admins:** See all workspace activity
 *       - **Members:** See only their own personal activity
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Workspace activity retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675900"
 *                   type: "task_created"
 *                   action: "created task 'Implement OAuth2'"
 *                   performedBy:
 *                     _id: "69bce50b96fe109fe4e14ff6"
 *                     name: "Alice Smith"
 *                   createdAt: "2026-03-30T08:00:00Z"
 *               total: 42
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/workspaces/:workspaceId/activity", protect, activityController.getUserActivity);
module.exports = router;
