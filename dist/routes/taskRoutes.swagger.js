"use strict";
/**
 * @swagger
 * /api/lists/{listId}/tasks:
 *   get:
 *     summary: Get all tasks in a list
 *     description: Returns all tasks within a specific list
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: List not found
 *   post:
 *     summary: Create a new task
 *     description: Creates a new task within a list
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *                 example: "Implement user authentication"
 *               description:
 *                 type: string
 *                 description: Task description
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *                 default: todo
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               assignee:
 *                 type: string
 *                 description: User ID of assignee
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               isRecurring:
 *                 type: boolean
 *                 default: false
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, custom]
 *               interval:
 *                 type: number
 *                 description: Recurrence interval
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     description: Returns detailed task information
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   patch:
 *     summary: Update task
 *     description: Updates task properties
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               assignee:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               startDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   delete:
 *     summary: Delete task
 *     description: Deletes a task permanently
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
