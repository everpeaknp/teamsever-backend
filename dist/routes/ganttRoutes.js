"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const ganttController = require("../controllers/ganttController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * tags:
 *   name: Gantt
 *   description: Gantt chart and timeline management
 */
const router = express.Router();
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/gantt/tasks/{taskId}/update-timeline:
 *   post:
 *     summary: Update task timeline
 *     description: Update task timeline and cascade changes to dependent tasks
 *     tags: [Gantt]
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
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               dueDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Timeline updated successfully
 *       401:
 *         description: Authentication required
 */
router.post("/tasks/:taskId/update-timeline", ganttController.updateTaskTimeline);
/**
 * @swagger
 * /api/gantt/spaces/{spaceId}:
 *   get:
 *     summary: Get Gantt chart data
 *     description: Retrieve Gantt chart data for a space
 *     tags: [Gantt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gantt data retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/spaces/:spaceId", ganttController.getGanttData);
/**
 * @swagger
 * /api/gantt/tasks/{taskId}/validate:
 *   get:
 *     summary: Validate task timeline
 *     description: Validate task timeline constraints and dependencies
 *     tags: [Gantt]
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
 *         description: Timeline validation result
 *       401:
 *         description: Authentication required
 */
router.get("/tasks/:taskId/validate", ganttController.validateTimeline);
/**
 * @swagger
 * /api/gantt/tasks/{taskId}/toggle-milestone:
 *   post:
 *     summary: Toggle milestone status
 *     description: Toggle task milestone status
 *     tags: [Gantt]
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
 *         description: Milestone status toggled successfully
 *       401:
 *         description: Authentication required
 */
router.post("/tasks/:taskId/toggle-milestone", ganttController.toggleMilestone);
module.exports = router;
