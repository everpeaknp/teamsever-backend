const express = require("express");
const router = express.Router();
const {
  startTimer,
  stopTimer,
  addManualTime,
  getTaskTimeSummary,
  getProjectTimeSummary,
  getRunningTimer,
  deleteTimeEntry
} = require("../controllers/timeEntryController");
const {
  getWorkspaceActiveTimers,
  getTeamTimesheets,
  adminStopTimer,
  getWorkspaceTimeStats,
  cleanupOrphanedTimers,
  stopAllUserTimers
} = require("../controllers/adminTimeController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const {
  startTimerSchema,
  addManualTimeSchema
} = require("../validators/timeEntryValidators");

// All routes require authentication
router.use(protect);

// ============================================
// ADMIN ROUTES (Workspace Admin/Owner only)
// ============================================

/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/active:
 *   get:
 *     summary: Get workspace active timers (Admin)
 *     description: Get all active timers in workspace (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Active timers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/admin/workspace/:workspaceId/active", getWorkspaceActiveTimers);

/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/timesheets:
 *   get:
 *     summary: Get team timesheets (Admin)
 *     description: Get team timesheets for workspace (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timesheets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/admin/workspace/:workspaceId/timesheets", getTeamTimesheets);

/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/stats:
 *   get:
 *     summary: Get workspace time stats (Admin)
 *     description: Get workspace time statistics (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/admin/workspace/:workspaceId/stats", getWorkspaceTimeStats);

/**
 * @swagger
 * /api/time/admin/stop/{entryId}:
 *   post:
 *     summary: Admin force-stop timer
 *     description: Force stop a running timer (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timer stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/admin/stop/:entryId", adminStopTimer);

/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/cleanup-orphaned:
 *   post:
 *     summary: Cleanup orphaned timers (Admin)
 *     description: Cleanup orphaned timers in workspace (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orphaned timers cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/admin/workspace/:workspaceId/cleanup-orphaned", cleanupOrphanedTimers);

/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/stop-user-timers/{userId}:
 *   post:
 *     summary: Stop all user timers (Admin)
 *     description: Stop all running timers for a user (Admin only)
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User timers stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/admin/workspace/:workspaceId/stop-user-timers/:userId", stopAllUserTimers);

// ============================================
// USER ROUTES
// ============================================

/**
 * @swagger
 * /api/time/start/{taskId}:
 *   post:
 *     summary: Start timer
 *     description: Start a time tracking timer for a task
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/TimeStartInput"
 *     responses:
 *       201:
 *         description: Timer started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/start/:taskId", validate(startTimerSchema), startTimer);

/**
 * @swagger
 * /api/time/stop/{entryId}:
 *   post:
 *     summary: Stop timer
 *     description: Stop a running timer
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Timer stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/stop/:entryId", stopTimer);

/**
 * @swagger
 * /api/time/manual:
 *   post:
 *     summary: Add manual time entry
 *     description: Add a manual time entry for a task
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/ManualTimeInput"
 *     responses:
 *       201:
 *         description: Manual time entry added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/manual", validate(addManualTimeSchema), addManualTime);

/**
 * @swagger
 * /api/time/running:
 *   get:
 *     summary: Get my running timer
 *     description: Returns the user's currently active timer. Returns null data if no timer is running. Check this on app startup to restore the timer UI.
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Running timer or null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RunningTimerResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/running", getRunningTimer);

/**
 * @swagger
 * /api/time/task/{taskId}:
 *   get:
 *     summary: Get task time summary
 *     description: Returns total time logged for a task plus a breakdown of individual entries.
 *     tags: ["7.1 Time — Entries (Timesheets)"]
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
 *         description: Task time summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TaskTimeSummaryResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/task/:taskId", getTaskTimeSummary);

/**
 * @swagger
 * /api/time/project/{projectId}:
 *   get:
 *     summary: Get project time summary
 *     description: Get time tracking summary for a project
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project time summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/project/:projectId", getProjectTimeSummary);

/**
 * @swagger
 * /api/time/{entryId}:
 *   delete:
 *     summary: Delete time entry
 *     description: Delete a time entry
 *     tags: ["7.1 Time — Entries (Timesheets)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time entry deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.delete("/:entryId", deleteTimeEntry);

module.exports = router;

export {};
