import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const recurringService = require("../services/recurringService");

// @desc    Get all recurring tasks in workspace
// @route   GET /api/recurring/workspace/:workspaceId
// @access  Private
const getRecurringTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;

  const tasks = await recurringService.getRecurringTasks(workspaceId, req.user!.id);

  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks
  });
});

// @desc    Get instances of a recurring task
// @route   GET /api/recurring/:taskId/instances
// @access  Private
const getRecurringTaskInstances = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { taskId } = req.params;

  const instances = await recurringService.getRecurringTaskInstances(taskId, req.user!.id);

  res.status(200).json({
    success: true,
    count: instances.length,
    data: instances
  });
});

// @desc    Stop a recurring task
// @route   POST /api/recurring/:taskId/stop
// @access  Private
const stopRecurringTask = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { taskId } = req.params;

  const task = await recurringService.stopRecurringTask(taskId, req.user!.id);

  res.status(200).json({
    success: true,
    data: task
  });
});

// @desc    Manually trigger recurring task processing (admin only)
// @route   POST /api/recurring/process
// @access  Private
const processRecurringTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await recurringService.processRecurringTasks();

  res.status(200).json({
    success: true,
    data: result
  });
});

module.exports = {
  getRecurringTasks,
  getRecurringTaskInstances,
  stopRecurringTask,
  processRecurringTasks
};

export {};
