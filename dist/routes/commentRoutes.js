"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const commentController = require("../controllers/commentController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { createCommentSchema, editCommentSchema, } = require("../validators/commentValidators");
/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Task comments management
 */
// Task-scoped comment routes
const taskCommentRouter = express.Router({ mergeParams: true });
taskCommentRouter.use(protect);
/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   post:
 *     summary: Create comment
 *     description: Add a comment to a task
 *     tags: [Comments]
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 *   get:
 *     summary: Get task comments
 *     description: Retrieve all comments for a task
 *     tags: [Comments]
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
 *         description: Comments retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
taskCommentRouter.post("/", validate(createCommentSchema), commentController.createComment);
taskCommentRouter.get("/", commentController.getTaskComments);
// Standalone comment routes
const commentRouter = express.Router();
commentRouter.use(protect);
/**
 * @swagger
 * /api/comments/{commentId}:
 *   get:
 *     summary: Get single comment
 *     description: Retrieve a specific comment by ID
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 *   patch:
 *     summary: Edit comment
 *     description: Update a comment's content
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to edit this comment
 *       404:
 *         description: Comment not found
 *   delete:
 *     summary: Delete comment
 *     description: Remove a comment from a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
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
commentRouter.get("/:commentId", commentController.getComment);
commentRouter.patch("/:commentId", validate(editCommentSchema), commentController.editComment);
commentRouter.delete("/:commentId", commentController.deleteComment);
module.exports = { taskCommentRouter, commentRouter };
