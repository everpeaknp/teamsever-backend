"use strict";
/**
 * @swagger
 * /api/tasks/{taskId}/time-entries:
 *   get:
 *     summary: Get time entries for a task
 *     description: Returns all time tracking entries for a specific task
 *     tags: [Time Tracking]
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
 *         description: List of time entries
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Start time tracking
 *     description: Starts a new time tracking entry for a task
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Time tracking started
 *       401:
 *         description: Unauthorized
 *
 * /api/tasks/{taskId}/time-entries/{entryId}/stop:
 *   patch:
 *     summary: Stop time tracking
 *     description: Stops an active time tracking entry
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time tracking stopped
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
