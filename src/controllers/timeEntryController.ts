import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const timeEntryService = require("../services/timeEntryService");

// @desc    Start timer for a task
// @route   POST /api/time/start/:taskId
// @access  Private
const startTimer = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { taskId } = req.params;
  const { description } = req.body;

  const timeEntry = await timeEntryService.startTimer({
    taskId,
    userId: req.user!.id,
    description
  });

  res.status(201).json({
    success: true,
    data: timeEntry
  });
});

// @desc    Stop running timer
// @route   POST /api/time/stop/:entryId
// @access  Private
const stopTimer = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { entryId } = req.params;

  const timeEntry = await timeEntryService.stopTimer({
    entryId,
    userId: req.user!.id
  });

  res.status(200).json({
    success: true,
    data: timeEntry
  });
});

// @desc    Add manual time entry
// @route   POST /api/time/manual
// @access  Private
const addManualTime = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { taskId, startTime, endTime, description } = req.body;

  const timeEntry = await timeEntryService.addManualTime({
    taskId,
    userId: req.user!.id,
    startTime,
    endTime,
    description
  });

  res.status(201).json({
    success: true,
    data: timeEntry
  });
});

// @desc    Get time summary for a task
// @route   GET /api/time/task/:taskId
// @access  Private
const getTaskTimeSummary = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { taskId } = req.params;

  const summary = await timeEntryService.getTaskTimeSummary(taskId, req.user!.id);

  res.status(200).json({
    success: true,
    data: summary
  });
});

// @desc    Get time summary for a project
// @route   GET /api/time/project/:projectId
// @access  Private
const getProjectTimeSummary = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { projectId } = req.params;

  const summary = await timeEntryService.getProjectTimeSummary(projectId, req.user!.id);

  res.status(200).json({
    success: true,
    data: summary
  });
});

// @desc    Get user's running timer
// @route   GET /api/time/running
// @access  Private
const getRunningTimer = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const runningTimer = await timeEntryService.getRunningTimer(req.user!.id);

  res.status(200).json({
    success: true,
    data: runningTimer
  });
});

// @desc    Delete time entry
// @route   DELETE /api/time/:entryId
// @access  Private
const deleteTimeEntry = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { entryId } = req.params;

  const result = await timeEntryService.deleteTimeEntry(entryId, req.user!.id);

  res.status(200).json({
    success: true,
    data: result
  });
});

module.exports = {
  startTimer,
  stopTimer,
  addManualTime,
  getTaskTimeSummary,
  getProjectTimeSummary,
  getRunningTimer,
  deleteTimeEntry
};

export {};
