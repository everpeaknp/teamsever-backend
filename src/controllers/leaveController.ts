import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const leaveService = require("../services/leaveService").default || require("../services/leaveService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Request Leave
 * POST /api/workspaces/:workspaceId/leaves
 */
export const requestLeave = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const requesterId = req.user?.id;
  const { assignedManagerId, conversationId, startDate, endDate, reason, requestType, remoteAreaId, proposedRemoteArea } = req.body;

  if (!assignedManagerId) {
    return next(new AppError("Assigned manager ID is required", 400));
  }

  if (!startDate || !endDate) {
    return next(new AppError("Start date and end date are required", 400));
  }

  if (!reason || !reason.trim()) {
    return next(new AppError("Leave reason is compulsory", 400));
  }

  const leave = await leaveService.requestLeave({
    workspaceId,
    requesterId,
    assignedManagerId,
    conversationId,
    startDate,
    endDate,
    reason,
    requestType,
    remoteAreaId,
    proposedRemoteArea,
  });

  res.status(201).json({
    success: true,
    data: leave,
    message: "Leave request submitted successfully",
  });
});

/**
 * Approve Leave
 * PATCH /api/workspaces/:workspaceId/leaves/:leaveId/approve
 */
export const approveLeave = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId, leaveId } = req.params;
  const approverId = req.user?.id;

  const leave = await leaveService.approveLeave(leaveId, approverId, workspaceId);

  res.status(200).json({
    success: true,
    data: leave,
    message: "Leave request approved successfully",
  });
});

/**
 * Deny Leave
 * PATCH /api/workspaces/:workspaceId/leaves/:leaveId/deny
 */
export const denyLeave = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId, leaveId } = req.params;
  const denierId = req.user?.id;
  const { denialReason } = req.body;

  const leave = await leaveService.denyLeave(leaveId, denierId, workspaceId, denialReason);

  res.status(200).json({
    success: true,
    data: leave,
    message: "Leave request denied",
  });
});

/**
 * Get workspace leaves
 * GET /api/workspaces/:workspaceId/leaves
 */
export const getWorkspaceLeaves = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const leaves = await leaveService.getWorkspaceLeaves(workspaceId, req.query);

  res.status(200).json({
    success: true,
    data: leaves,
  });
});

export const getRemoteRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { workspaceId } = req.params;
  const requests = await leaveService.getRemoteRequests(workspaceId, req.user!.id);
  res.status(200).json({ success: true, data: requests });
});

export const getMyRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const requests = await leaveService.getMyRequests(req.params.workspaceId, req.user!.id);
  res.status(200).json({ success: true, data: requests });
});

export const getAssignedInbox = asyncHandler(async (req: AuthRequest, res: Response) => {
  const requests = await leaveService.getAssignedInbox(req.params.workspaceId, req.user!.id);
  res.status(200).json({ success: true, data: requests });
});

/**
 * Get active leaves today (for "Who's on leave" banner)
 * GET /api/workspaces/:workspaceId/leaves/today
 */
export const getActiveLeavesToday = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const leaves = await leaveService.getActiveLeavesToday(workspaceId);

  res.status(200).json({
    success: true,
    data: leaves,
  });
});

/**
 * Get user monthly approved leave stats / quota check
 * GET /api/workspaces/:workspaceId/leaves/my-quota
 */
export const getMyLeaveQuota = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  const userId = req.user?.id;
  const dateStr = req.query.date as string;
  const checkDate = dateStr ? new Date(dateStr) : new Date();

  const approvedDaysThisMonth = await leaveService.getMonthlyApprovedLeaveDays(workspaceId, userId, checkDate);

  res.status(200).json({
    success: true,
    data: {
      approvedDaysThisMonth,
      standardLimit: 2,
      isExceeded: approvedDaysThisMonth >= 2,
    },
  });
});
