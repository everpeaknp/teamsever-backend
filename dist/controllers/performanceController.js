"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const performanceService = require("../services/performanceService");
const AppError = require("../utils/AppError");
// @desc    Get user performance metrics
// @route   GET /api/performance/user/:userId/workspace/:workspaceId
// @access  Private
exports.getUserPerformance = asyncHandler(async (req, res, next) => {
    const { userId, workspaceId } = req.params;
    const metrics = await performanceService.getUserPerformance(userId, workspaceId);
    res.status(200).json({
        success: true,
        data: metrics
    });
});
// @desc    Get current user's performance metrics
// @route   GET /api/performance/me/workspace/:workspaceId
// @access  Private
exports.getMyPerformance = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const metrics = await performanceService.getUserPerformance(userId, workspaceId);
    res.status(200).json({
        success: true,
        data: metrics
    });
});
// @desc    Get team performance metrics
// @route   GET /api/performance/team/workspace/:workspaceId
// @access  Private
exports.getTeamPerformance = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const teamMetrics = await performanceService.getTeamPerformance(workspaceId);
    res.status(200).json({
        success: true,
        data: teamMetrics
    });
});
// @desc    Get workspace performance summary
// @route   GET /api/performance/workspace/:workspaceId/summary
// @access  Private
exports.getWorkspacePerformanceSummary = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const summary = await performanceService.getWorkspacePerformanceSummary(workspaceId);
    res.status(200).json({
        success: true,
        data: summary
    });
});
