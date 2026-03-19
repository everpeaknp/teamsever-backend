"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { startTimer, stopTimer, getActiveTimer, addManualTimeLog, getTimeLogs, deleteTimeLog, } = require("../controllers/timeTrackingController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/tasks/time/active:
 *   get:
 *     summary: Get active timer for current user
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active timer data or null
 */
router.get("/time/active", getActiveTimer);
/**
 * @swagger
 * /api/tasks/{id}/time/start:
 *   post:
 *     summary: Start timer for a task
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timer started successfully
 *       400:
 *         description: Timer already active
 */
router.post("/:id/time/start", startTimer);
/**
 * @swagger
 * /api/tasks/{id}/time/stop:
 *   post:
 *     summary: Stop timer for a task
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *       200:
 *         description: Timer stopped successfully
 */
router.post("/:id/time/stop", stopTimer);
/**
 * @swagger
 * /api/tasks/{id}/time/manual:
 *   post:
 *     summary: Add manual time log
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - duration
 *             properties:
 *               duration:
 *                 type: string
 *                 description: Duration in format like "2h 30m", "1.5h", or "90m"
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Manual time log added
 */
router.post("/:id/time/manual", addManualTimeLog);
/**
 * @swagger
 * /api/tasks/{id}/time/logs:
 *   get:
 *     summary: Get time logs for a task
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time logs retrieved successfully
 */
router.get("/:id/time/logs", getTimeLogs);
/**
 * @swagger
 * /api/tasks/{id}/time/logs/{logId}:
 *   delete:
 *     summary: Delete a time log
 *     tags: [Time Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time log deleted successfully
 */
router.delete("/:id/time/logs/:logId", deleteTimeLog);
module.exports = router;
