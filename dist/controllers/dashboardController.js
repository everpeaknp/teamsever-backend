"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const dashboardService = require("../services/dashboardService");
// @desc    Get tasks summary
// @route   GET /api/dashboard/tasks/summary
// @access  Private
const getTasksSummary = asyncHandler(async (req, res, next) => {
    const { workspaceId, spaceId, listId } = req.query;
    const summary = await dashboardService.getTasksSummary(req.user.id, {
        workspaceId: workspaceId,
        spaceId: spaceId,
        listId: listId
    });
    res.status(200).json({
        success: true,
        data: summary
    });
});
// @desc    Get workload
// @route   GET /api/dashboard/workload
// @access  Private
const getWorkload = asyncHandler(async (req, res, next) => {
    const { workspaceId, spaceId } = req.query;
    const workload = await dashboardService.getWorkload(req.user.id, {
        workspaceId: workspaceId,
        spaceId: spaceId
    });
    res.status(200).json({
        success: true,
        count: workload.length,
        data: workload
    });
});
// @desc    Get status breakdown
// @route   GET /api/dashboard/status-breakdown
// @access  Private
const getStatusBreakdown = asyncHandler(async (req, res, next) => {
    const { workspaceId, spaceId, listId } = req.query;
    const breakdown = await dashboardService.getStatusBreakdown(req.user.id, {
        workspaceId: workspaceId,
        spaceId: spaceId,
        listId: listId
    });
    res.status(200).json({
        success: true,
        data: breakdown
    });
});
module.exports = {
    getTasksSummary,
    getWorkload,
    getStatusBreakdown
};
