"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const { getAttendanceReport, exportAttendanceCSV, exportAttendanceExcel } = require("../controllers/attendanceController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance and clock-in reporting
 */
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/report:
 *   get:
 *     summary: Get attendance report
 *     description: Retrieve detailed attendance / clock-in records for a workspace. Admins can filter by userId; regular users only see their own. Supports "Lifetime" view if dates are omitted.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (inclusive). Omit for lifetime report.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (inclusive). Omit for lifetime report.
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (Admin/Owner only)
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by Space/Project ID
 *     responses:
 *       200:
 *         description: Report retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "entry_1"
 *                   userName: "John Doe"
 *                   userEmail: "john@example.com"
 *                   date: "2026-03-30"
 *                   clockIn: "2026-03-30T09:00:00Z"
 *                   clockOut: "2026-03-30T17:00:00Z"
 *                   durationFormatted: "8h 0m"
 *                   description: "Development work"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/workspace/:workspaceId/report", getAttendanceReport);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/export:
 *   get:
 *     summary: Export attendance report (CSV)
 *     description: Download a CSV file containing attendance records based on filters.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/workspace/:workspaceId/export", exportAttendanceCSV);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/export-excel:
 *   get:
 *     summary: Export attendance report (Excel)
 *     description: Download a native Excel (.xlsx) file containing attendance records.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/workspace/:workspaceId/export-excel", exportAttendanceExcel);
module.exports = router;
