const express = require("express");
const {
  startTimer,
  stopTimer,
  getActiveTimer,
  addManualTimeLog,
  getTimeLogs,
  deleteTimeLog,
} = require("../controllers/timeTrackingController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(protect);

// NOTE: These routes are task-scoped timer helpers.
// For the managed timer system (with workspace admin controls), use timeEntryRoutes:
//   POST /api/time/start/{taskId}
//   POST /api/time/stop/{entryId}
//   GET  /api/time/running

/**
 * @swagger
 * /api/tasks/time/active:
 *   get:
 *     summary: Get my active timer
 *     description: Returns the currently running timer for the authenticated user, or null if no timer is running. Useful for showing a persistent timer widget at the top of the app.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active timer (or null)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/time/active", getActiveTimer);

/**
 * @swagger
 * /api/tasks/{id}/time/start:
 *   post:
 *     summary: Start task timer
 *     description: Start a timer for a specific task. Only one timer can run at a time per user.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
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
 *         description: Timer started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       400:
 *         description: Timer already active — stop existing timer first
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/:id/time/start", startTimer);

/**
 * @swagger
 * /api/tasks/{id}/time/stop:
 *   post:
 *     summary: Stop task timer
 *     description: Stop the active timer for a task and record the time entry.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Implemented token refresh flow"
 *     responses:
 *       200:
 *         description: Timer stopped and entry recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/:id/time/stop", stopTimer);

/**
 * @swagger
 * /api/tasks/{id}/time/manual:
 *   post:
 *     summary: Log manual time
 *     description: Add a manual time entry for a task without using the timer. Useful for logging offline work.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
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
 *             required:
 *               - duration
 *             properties:
 *               duration:
 *                 type: string
 *                 example: "2h 30m"
 *                 description: Duration string — supports "2h 30m", "1.5h", "90m"
 *               description:
 *                 type: string
 *                 example: "Design review session"
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-29T14:00:00Z"
 *     responses:
 *       201:
 *         description: Manual time log added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/:id/time/manual", addManualTimeLog);

/**
 * @swagger
 * /api/tasks/{id}/time/logs:
 *   get:
 *     summary: Get task time logs
 *     description: Returns all time entries for a specific task.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
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
 *         description: Time logs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/:id/time/logs", getTimeLogs);

/**
 * @swagger
 * /api/tasks/{id}/time/logs/{logId}:
 *   delete:
 *     summary: Delete time log
 *     description: Delete a specific time log entry.
 *     tags: ["7.2 Time — Tracking (Live Timer)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *         description: Time log ID
 *     responses:
 *       200:
 *         description: Time log deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TimeTrackingResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.delete("/:id/time/logs/:logId", deleteTimeLog);

module.exports = router;

export {};
