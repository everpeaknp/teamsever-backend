"use strict";
/**
 * @swagger
 * /api/dashboard/tasks/summary:
 *   get:
 *     summary: Get tasks summary
 *     description: Returns summary of tasks for the current user
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tasks summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 completed:
 *                   type: integer
 *                 inProgress:
 *                   type: integer
 *                 todo:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *
 * /api/dashboard/workload:
 *   get:
 *     summary: Get user workload
 *     description: Returns workload information for current user
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workload data
 *       401:
 *         description: Unauthorized
 *
 * /api/dashboard/status-breakdown:
 *   get:
 *     summary: Get status breakdown
 *     description: Returns breakdown of tasks by status
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status breakdown
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
