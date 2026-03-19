"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const timeEntryService = require("../services/timeEntryService");
/**
 * Admin Time Tracking Controllers
 * These endpoints are restricted to workspace admins/owners only
 */
// @desc    Get all active timers in workspace
// @route   GET /api/time/admin/workspace/:workspaceId/active
// @access  Private (Admin/Owner only)
const getWorkspaceActiveTimers = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const data = await timeEntryService.getWorkspaceActiveTimers(workspaceId, req.user.id);
    res.status(200).json({
        success: true,
        data
    });
});
// @desc    Get team timesheets with filters
// @route   GET /api/time/admin/workspace/:workspaceId/timesheets
// @access  Private (Admin/Owner only)
const getTeamTimesheets = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const { startDate, endDate, userId, projectId } = req.query;
    const data = await timeEntryService.getTeamTimesheets(workspaceId, req.user.id, {
        startDate: startDate,
        endDate: endDate,
        userId: userId,
        projectId: projectId
    });
    res.status(200).json({
        success: true,
        data
    });
});
// @desc    Admin force-stop a running timer
// @route   POST /api/time/admin/stop/:entryId
// @access  Private (Admin/Owner only)
const adminStopTimer = asyncHandler(async (req, res, next) => {
    const { entryId } = req.params;
    const { reason } = req.body;
    const timeEntry = await timeEntryService.adminStopTimer(entryId, req.user.id, reason);
    res.status(200).json({
        success: true,
        message: "Timer stopped successfully",
        data: timeEntry
    });
});
// @desc    Get workspace time tracking statistics
// @route   GET /api/time/admin/workspace/:workspaceId/stats
// @access  Private (Admin/Owner only)
const getWorkspaceTimeStats = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const stats = await timeEntryService.getWorkspaceTimeStats(workspaceId, req.user.id);
    res.status(200).json({
        success: true,
        data: stats
    });
});
// @desc    Cleanup orphaned timers (running > 24 hours)
// @route   POST /api/time/admin/workspace/:workspaceId/cleanup-orphaned
// @access  Private (Admin/Owner only)
const cleanupOrphanedTimers = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const result = await timeEntryService.cleanupOrphanedTimers(workspaceId, req.user.id);
    res.status(200).json({
        success: true,
        message: result.message,
        data: result
    });
});
// @desc    Stop all running timers for a specific user
// @route   POST /api/time/admin/workspace/:workspaceId/stop-user-timers/:userId
// @access  Private (Admin/Owner only)
const stopAllUserTimers = asyncHandler(async (req, res, next) => {
    const { workspaceId, userId } = req.params;
    const { reason } = req.body;
    const result = await timeEntryService.stopAllUserTimers(workspaceId, userId, req.user.id, reason);
    res.status(200).json({
        success: true,
        message: result.message,
        data: result
    });
});
module.exports = {
    getWorkspaceActiveTimers,
    getTeamTimesheets,
    adminStopTimer,
    getWorkspaceTimeStats,
    cleanupOrphanedTimers,
    stopAllUserTimers
};
