"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const analyticsService = require("../services/analyticsService");
/**
 * Get velocity data (tasks completed per day)
 * GET /api/analytics/velocity
 */
exports.getVelocity = async (req, res, next) => {
    try {
        const { workspaceId } = req.query;
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30;
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "workspaceId is required"
            });
        }
        const velocityData = await analyticsService.getVelocity(workspaceId, userId, days);
        res.status(200).json({
            success: true,
            data: velocityData
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get lead time data (average time from created to done)
 * GET /api/analytics/lead-time
 */
exports.getLeadTime = async (req, res, next) => {
    try {
        const { workspaceId } = req.query;
        const userId = req.user.id;
        const days = parseInt(req.query.days) || 30;
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "workspaceId is required"
            });
        }
        const leadTimeData = await analyticsService.getLeadTime(workspaceId, userId, days);
        res.status(200).json({
            success: true,
            data: leadTimeData
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get burn-down data (open vs completed tasks)
 * GET /api/analytics/burn-down
 */
exports.getBurnDown = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const userId = req.user.id;
        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: "projectId is required"
            });
        }
        const burnDownData = await analyticsService.getBurnDown(projectId, userId);
        res.status(200).json({
            success: true,
            data: burnDownData
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get comprehensive workspace analytics
 * GET /api/analytics/workspace/:workspaceId
 */
exports.getWorkspaceAnalytics = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user.id;
        const analytics = await analyticsService.getWorkspaceAnalytics(workspaceId, userId);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get workspace overview summary
 * GET /api/workspaces/:workspaceId/analytics/summary
 */
exports.getWorkspaceOverview = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user.id;
        const overview = await analyticsService.getWorkspaceOverview(workspaceId, userId);
        res.status(200).json({
            success: true,
            data: overview
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get team workload
 * GET /api/workspaces/:workspaceId/analytics/workload
 */
exports.getTeamWorkload = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user.id;
        const workload = await analyticsService.getTeamWorkload(workspaceId, userId);
        res.status(200).json({
            success: true,
            data: workload
        });
    }
    catch (error) {
        next(error);
    }
};
