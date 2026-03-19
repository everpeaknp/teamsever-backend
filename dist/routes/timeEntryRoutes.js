"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { startTimer, stopTimer, addManualTime, getTaskTimeSummary, getProjectTimeSummary, getRunningTimer, deleteTimeEntry } = require("../controllers/timeEntryController");
const { getWorkspaceActiveTimers, getTeamTimesheets, adminStopTimer, getWorkspaceTimeStats, cleanupOrphanedTimers, stopAllUserTimers } = require("../controllers/adminTimeController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { startTimerSchema, addManualTimeSchema } = require("../validators/timeEntryValidators");
/**
 * @swagger
 * tags:
 *   name: Time Entries
 *   description: Time tracking and time entry management
 */
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
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.get("/admin/workspace/:workspaceId/active", getWorkspaceActiveTimers);
/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/timesheets:
 *   get:
 *     summary: Get team timesheets (Admin)
 *     description: Get team timesheets for workspace (Admin only)
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.get("/admin/workspace/:workspaceId/timesheets", getTeamTimesheets);
/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/stats:
 *   get:
 *     summary: Get workspace time stats (Admin)
 *     description: Get workspace time statistics (Admin only)
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.get("/admin/workspace/:workspaceId/stats", getWorkspaceTimeStats);
/**
 * @swagger
 * /api/time/admin/stop/{entryId}:
 *   post:
 *     summary: Admin force-stop timer
 *     description: Force stop a running timer (Admin only)
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.post("/admin/stop/:entryId", adminStopTimer);
/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/cleanup-orphaned:
 *   post:
 *     summary: Cleanup orphaned timers (Admin)
 *     description: Cleanup orphaned timers in workspace (Admin only)
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
 */
router.post("/admin/workspace/:workspaceId/cleanup-orphaned", cleanupOrphanedTimers);
/**
 * @swagger
 * /api/time/admin/workspace/{workspaceId}/stop-user-timers/{userId}:
 *   post:
 *     summary: Stop all user timers (Admin)
 *     description: Stop all running timers for a user (Admin only)
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin privileges required
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
 *     tags: [Time Entries]
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
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Timer started successfully
 *       401:
 *         description: Authentication required
 */
router.post("/start/:taskId", validate(startTimerSchema), startTimer);
/**
 * @swagger
 * /api/time/stop/{entryId}:
 *   post:
 *     summary: Stop timer
 *     description: Stop a running timer
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 */
router.post("/stop/:entryId", stopTimer);
/**
 * @swagger
 * /api/time/manual:
 *   post:
 *     summary: Add manual time entry
 *     description: Add a manual time entry for a task
 *     tags: [Time Entries]
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
 *               - duration
 *             properties:
 *               taskId:
 *                 type: string
 *               duration:
 *                 type: number
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Manual time entry added successfully
 *       401:
 *         description: Authentication required
 */
router.post("/manual", validate(addManualTimeSchema), addManualTime);
/**
 * @swagger
 * /api/time/running:
 *   get:
 *     summary: Get running timer
 *     description: Get user's currently running timer
 *     tags: [Time Entries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Running timer retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/running", getRunningTimer);
/**
 * @swagger
 * /api/time/task/{taskId}:
 *   get:
 *     summary: Get task time summary
 *     description: Get time tracking summary for a task
 *     tags: [Time Entries]
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
 *         description: Task time summary retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/task/:taskId", getTaskTimeSummary);
/**
 * @swagger
 * /api/time/project/{projectId}:
 *   get:
 *     summary: Get project time summary
 *     description: Get time tracking summary for a project
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 */
router.get("/project/:projectId", getProjectTimeSummary);
/**
 * @swagger
 * /api/time/{entryId}:
 *   delete:
 *     summary: Delete time entry
 *     description: Delete a time entry
 *     tags: [Time Entries]
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
 *       401:
 *         description: Authentication required
 */
router.delete("/:entryId", deleteTimeEntry);
module.exports = router;
