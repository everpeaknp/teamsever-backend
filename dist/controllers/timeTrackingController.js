"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const Task = require("../models/Task");
const AppError = require("../utils/AppError");
/**
 * @desc    Start timer for a task
 * @route   POST /api/tasks/:id/time/start
 * @access  Private
 */
const startTimer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    // Find the task
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError("Task not found", 404);
    }
    // Check if user already has an active timer on any task
    const activeTask = await Task.findOne({
        "activeTimer.user": userId,
        isDeleted: false,
    });
    if (activeTask) {
        throw new AppError(`You already have an active timer on task: ${activeTask.title}. Please stop it first.`, 400);
    }
    // Check if this task already has an active timer
    if (task.activeTimer && task.activeTimer.user) {
        throw new AppError("This task already has an active timer", 400);
    }
    // Start the timer
    task.activeTimer = {
        user: userId,
        startTime: new Date(),
    };
    await task.save();
    res.status(200).json({
        success: true,
        message: "Timer started successfully",
        data: {
            taskId: task._id,
            title: task.title,
            startTime: task.activeTimer.startTime,
        },
    });
});
/**
 * @desc    Stop timer for a task
 * @route   POST /api/tasks/:id/time/stop
 * @access  Private
 */
const stopTimer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { description } = req.body;
    // Find the task
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError("Task not found", 404);
    }
    // Check if there's an active timer
    if (!task.activeTimer || !task.activeTimer.user) {
        throw new AppError("No active timer found for this task", 400);
    }
    // Check if the user owns this timer
    if (task.activeTimer.user.toString() !== userId) {
        throw new AppError("You can only stop your own timer", 403);
    }
    // Calculate duration
    const endTime = new Date();
    const startTime = task.activeTimer.startTime;
    const duration = endTime.getTime() - startTime.getTime();
    // Create time log
    const timeLog = {
        user: userId,
        startTime,
        endTime,
        duration,
        description: description || "",
        isManual: false,
    };
    // Add to timeLogs array
    if (!task.timeLogs) {
        task.timeLogs = [];
    }
    task.timeLogs.push(timeLog);
    // Update total time spent
    task.totalTimeSpent = (task.totalTimeSpent || 0) + duration;
    // Clear active timer
    task.activeTimer = undefined;
    await task.save();
    res.status(200).json({
        success: true,
        message: "Timer stopped successfully",
        data: {
            taskId: task._id,
            title: task.title,
            timeLog: {
                startTime,
                endTime,
                duration,
                durationFormatted: formatDuration(duration),
            },
            totalTimeSpent: task.totalTimeSpent,
            totalTimeSpentFormatted: formatDuration(task.totalTimeSpent),
        },
    });
});
/**
 * @desc    Get active timer for current user
 * @route   GET /api/tasks/time/active
 * @access  Private
 */
const getActiveTimer = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const task = await Task.findOne({
        "activeTimer.user": userId,
        isDeleted: false,
    }).select("_id title activeTimer");
    if (!task || !task.activeTimer) {
        return res.status(200).json({
            success: true,
            data: null,
        });
    }
    const elapsed = Date.now() - task.activeTimer.startTime.getTime();
    res.status(200).json({
        success: true,
        data: {
            taskId: task._id,
            title: task.title,
            startTime: task.activeTimer.startTime,
            elapsed,
            elapsedFormatted: formatDuration(elapsed),
        },
    });
});
/**
 * @desc    Add manual time log
 * @route   POST /api/tasks/:id/time/manual
 * @access  Private
 */
const addManualTimeLog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { duration, description, date } = req.body;
    if (!duration || duration <= 0) {
        throw new AppError("Please provide a valid duration", 400);
    }
    // Find the task
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError("Task not found", 404);
    }
    // Parse duration (supports formats like "2h 30m", "1.5h", "90m")
    const durationMs = parseDuration(duration);
    if (!durationMs) {
        throw new AppError("Invalid duration format. Use formats like '2h 30m', '1.5h', or '90m'", 400);
    }
    // Create manual time log
    const logDate = date ? new Date(date) : new Date();
    const timeLog = {
        user: userId,
        startTime: logDate,
        endTime: new Date(logDate.getTime() + durationMs),
        duration: durationMs,
        description: description || "",
        isManual: true,
    };
    // Add to timeLogs array
    if (!task.timeLogs) {
        task.timeLogs = [];
    }
    task.timeLogs.push(timeLog);
    // Update total time spent
    task.totalTimeSpent = (task.totalTimeSpent || 0) + durationMs;
    await task.save();
    res.status(201).json({
        success: true,
        message: "Manual time log added successfully",
        data: {
            taskId: task._id,
            timeLog: {
                ...timeLog,
                durationFormatted: formatDuration(durationMs),
            },
            totalTimeSpent: task.totalTimeSpent,
            totalTimeSpentFormatted: formatDuration(task.totalTimeSpent),
        },
    });
});
/**
 * @desc    Get time logs for a task
 * @route   GET /api/tasks/:id/time/logs
 * @access  Private
 */
const getTimeLogs = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await Task.findById(id)
        .select("title timeLogs totalTimeSpent")
        .populate("timeLogs.user", "name email");
    if (!task) {
        throw new AppError("Task not found", 404);
    }
    const logs = task.timeLogs.map((log) => ({
        ...log.toObject(),
        durationFormatted: formatDuration(log.duration),
    }));
    res.status(200).json({
        success: true,
        data: {
            taskId: task._id,
            title: task.title,
            timeLogs: logs,
            totalTimeSpent: task.totalTimeSpent,
            totalTimeSpentFormatted: formatDuration(task.totalTimeSpent || 0),
        },
    });
});
/**
 * @desc    Delete time log
 * @route   DELETE /api/tasks/:id/time/logs/:logId
 * @access  Private
 */
const deleteTimeLog = asyncHandler(async (req, res) => {
    const { id, logId } = req.params;
    const userId = req.user.id;
    const task = await Task.findById(id);
    if (!task) {
        throw new AppError("Task not found", 404);
    }
    const logIndex = task.timeLogs.findIndex((log) => log._id.toString() === logId);
    if (logIndex === -1) {
        throw new AppError("Time log not found", 404);
    }
    const log = task.timeLogs[logIndex];
    // Check if user owns this log
    if (log.user.toString() !== userId) {
        throw new AppError("You can only delete your own time logs", 403);
    }
    // Subtract from total time
    task.totalTimeSpent = Math.max(0, (task.totalTimeSpent || 0) - log.duration);
    // Remove the log
    task.timeLogs.splice(logIndex, 1);
    await task.save();
    res.status(200).json({
        success: true,
        message: "Time log deleted successfully",
        data: {
            totalTimeSpent: task.totalTimeSpent,
            totalTimeSpentFormatted: formatDuration(task.totalTimeSpent),
        },
    });
});
// Helper function to format duration
function formatDuration(ms) {
    if (!ms || ms < 0)
        return "0m";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${seconds}s`;
}
// Helper function to parse duration strings
function parseDuration(input) {
    if (typeof input === 'number') {
        return input;
    }
    const str = input.toLowerCase().trim();
    let totalMs = 0;
    // Match patterns like "2h 30m", "1.5h", "90m", "2d 3h"
    const dayMatch = str.match(/(\d+(?:\.\d+)?)\s*d/);
    const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
    const minuteMatch = str.match(/(\d+(?:\.\d+)?)\s*m/);
    const secondMatch = str.match(/(\d+(?:\.\d+)?)\s*s/);
    if (dayMatch) {
        totalMs += parseFloat(dayMatch[1]) * 24 * 60 * 60 * 1000;
    }
    if (hourMatch) {
        totalMs += parseFloat(hourMatch[1]) * 60 * 60 * 1000;
    }
    if (minuteMatch) {
        totalMs += parseFloat(minuteMatch[1]) * 60 * 1000;
    }
    if (secondMatch) {
        totalMs += parseFloat(secondMatch[1]) * 1000;
    }
    return totalMs > 0 ? totalMs : null;
}
module.exports = {
    startTimer,
    stopTimer,
    getActiveTimer,
    addManualTimeLog,
    getTimeLogs,
    deleteTimeLog,
};
