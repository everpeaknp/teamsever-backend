const asyncHandler = require("../utils/asyncHandler");
const performanceService = require("../services/performanceService");
const AppError = require("../utils/AppError");
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/authMiddleware";

// @desc    Get user performance metrics
// @route   GET /api/performance/user/:userId/workspace/:workspaceId
// @access  Private
exports.getUserPerformance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId, workspaceId } = req.params;

  const metrics = await performanceService.getUserPerformance(userId, workspaceId);

  res.status(200).json({
    success: true,
    message: "User performance metrics retrieved successfully",
    data: metrics
  });
});

// @desc    Get deep user performance details
// @route   GET /api/performance/user/:userId/workspace/:workspaceId/details
// @access  Private
exports.getUserPerformanceDetails = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId, workspaceId } = req.params;
  const limit = Number(req.query.limit || 100);
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const details = await performanceService.getUserPerformanceDetails(userId, workspaceId, limit, { from, to });

  res.status(200).json({
    success: true,
    message: "User performance details retrieved successfully",
    data: details
  });
});

// @desc    Get current user's performance metrics
// @route   GET /api/performance/me/workspace/:workspaceId
// @access  Private
exports.getMyPerformance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const userId = req.user!.id;

  const metrics = await performanceService.getUserPerformance(userId, workspaceId);

  res.status(200).json({
    success: true,
    message: "My performance metrics retrieved successfully",
    data: metrics
  });
});

// @desc    Get team performance metrics
// @route   GET /api/performance/team/workspace/:workspaceId
// @access  Private
exports.getTeamPerformance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const teamMetrics = await performanceService.getTeamPerformance(workspaceId, { from, to });

  res.status(200).json({
    success: true,
    message: "Team performance metrics retrieved successfully",
    data: teamMetrics
  });
});

// @desc    Get workspace performance summary
// @route   GET /api/performance/workspace/:workspaceId/summary
// @access  Private
exports.getWorkspacePerformanceSummary = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;

  const summary = await performanceService.getWorkspacePerformanceSummary(workspaceId);

  res.status(200).json({
    success: true,
    message: "Workspace performance summary retrieved successfully",
    data: summary
  });
});

export {};
