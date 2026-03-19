"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { createDependency, deleteDependency, getTaskDependencies, getBlockingTasks } = require("../controllers/taskDependencyController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { createTaskDependencySchema } = require("../validators/taskDependencyValidators");
/**
 * @swagger
 * tags:
 *   name: Task Dependencies
 *   description: Task dependency management
 */
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/task-dependencies:
 *   post:
 *     summary: Create task dependency
 *     description: Create a dependency relationship between two tasks
 *     tags: [Task Dependencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - dependsOnTaskId
 *             properties:
 *               taskId:
 *                 type: string
 *               dependsOnTaskId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [blocks, blocked_by]
 *     responses:
 *       201:
 *         description: Dependency created successfully
 *       400:
 *         description: Validation error or circular dependency
 *       401:
 *         description: Authentication required
 */
router.post("/", validate(createTaskDependencySchema), createDependency);
/**
 * @swagger
 * /api/task-dependencies/{id}:
 *   delete:
 *     summary: Delete task dependency
 *     description: Remove a dependency relationship between tasks
 *     tags: [Task Dependencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Dependency ID
 *     responses:
 *       200:
 *         description: Dependency deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Dependency not found
 */
router.delete("/:id", deleteDependency);
/**
 * @swagger
 * /api/task-dependencies/task/{taskId}:
 *   get:
 *     summary: Get task dependencies
 *     description: Retrieve all dependencies for a task
 *     tags: [Task Dependencies]
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
 *         description: Dependencies retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
router.get("/task/:taskId", getTaskDependencies);
/**
 * @swagger
 * /api/task-dependencies/task/{taskId}/blocking:
 *   get:
 *     summary: Get blocking tasks
 *     description: Retrieve all tasks that are blocking this task
 *     tags: [Task Dependencies]
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
 *         description: Blocking tasks retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
router.get("/task/:taskId/blocking", getBlockingTasks);
module.exports = router;
