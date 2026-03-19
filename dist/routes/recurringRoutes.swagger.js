"use strict";
/**
 * @swagger
 * /api/recurring/workspace/{workspaceId}:
 *   get:
 *     summary: Get recurring tasks
 *     description: Returns all active recurring tasks in a workspace
 *     tags: [Recurring Tasks]
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
 *         description: List of recurring tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *
 * /api/recurring/task/{taskId}/instances:
 *   get:
 *     summary: Get task instances
 *     description: Returns all instances created from a recurring task
 *     tags: [Recurring Tasks]
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
 *         description: List of task instances
 *       401:
 *         description: Unauthorized
 *
 * /api/recurring/task/{taskId}/stop:
 *   post:
 *     summary: Stop recurring task
 *     description: Stops a recurring task from creating new instances
 *     tags: [Recurring Tasks]
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
 *         description: Recurring task stopped
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
