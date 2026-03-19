"use strict";
/**
 * @swagger
 * /api/analytics/workspaces/{workspaceId}/summary:
 *   get:
 *     summary: Get workspace analytics summary
 *     description: |
 *       Returns comprehensive analytics for a workspace including:
 *       - Total tasks and completion rate
 *       - Priority distribution
 *       - Status distribution
 *       - Velocity (tasks completed per day)
 *       - Lead time (average days from creation to completion)
 *     tags: [Analytics]
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
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsSummary'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/analytics/workspaces/{workspaceId}/workload:
 *   get:
 *     summary: Get team workload analytics
 *     description: Returns workload distribution across team members
 *     tags: [Analytics]
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
 *         description: Team workload data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   user:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                   totalTasks:
 *                     type: number
 *                   completedTasks:
 *                     type: number
 *                   inProgressTasks:
 *                     type: number
 *                   todoTasks:
 *                     type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/analytics/workspaces/{workspaceId}/burndown:
 *   get:
 *     summary: Get burndown chart data
 *     description: Returns burndown chart data for sprint planning
 *     tags: [Analytics]
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Sprint start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Sprint end date
 *     responses:
 *       200:
 *         description: Burndown chart data
 *       401:
 *         description: Unauthorized
 */
Object.defineProperty(exports, "__esModule", { value: true });
