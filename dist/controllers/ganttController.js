"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ganttService = require("../services/ganttService");
const taskService = require("../services/taskService");
const Task = require("../models/Task");
const AppError = require("../utils/AppError");
/**
 * Update task dates and cascade to dependents
 * POST /api/gantt/tasks/:taskId/update-timeline
 */
exports.updateTaskTimeline = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { startDate, dueDate } = req.body;
        const userId = req.user.id;
        // Get current task to calculate delta
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Calculate date delta
        let dateDelta = 0;
        if (startDate && task.startDate) {
            dateDelta = ganttService.calculateDateDelta(task.startDate, new Date(startDate));
        }
        else if (dueDate && task.dueDate) {
            dateDelta = ganttService.calculateDateDelta(task.dueDate, new Date(dueDate));
        }
        // Update the task itself first
        const updateData = {};
        if (startDate !== undefined)
            updateData.startDate = startDate;
        if (dueDate !== undefined)
            updateData.dueDate = dueDate;
        await taskService.updateTask(taskId, userId, updateData);
        // Cascade changes to dependent tasks
        const result = await ganttService.updateTaskTimeline(taskId, dateDelta, userId);
        res.status(200).json({
            success: true,
            message: "Timeline updated successfully",
            data: {
                taskId,
                dateDelta,
                cascadeResult: result
            }
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get Gantt chart data for a space
 * GET /api/gantt/spaces/:spaceId
 */
exports.getGanttData = async (req, res, next) => {
    try {
        const { spaceId } = req.params;
        const userId = req.user.id;
        const ganttData = await ganttService.getGanttData(spaceId, userId);
        res.status(200).json({
            success: true,
            data: ganttData
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Validate task timeline constraints
 * GET /api/gantt/tasks/:taskId/validate
 */
exports.validateTimeline = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const validation = await ganttService.validateTimeline(taskId);
        res.status(200).json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Toggle milestone status
 * POST /api/gantt/tasks/:taskId/toggle-milestone
 */
exports.toggleMilestone = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const userId = req.user.id;
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Toggle milestone status
        const isMilestone = !task.isMilestone;
        // If becoming a milestone, set startDate = dueDate
        const updateData = { isMilestone };
        if (isMilestone && task.dueDate) {
            updateData.startDate = task.dueDate;
        }
        const updatedTask = await taskService.updateTask(taskId, userId, updateData);
        res.status(200).json({
            success: true,
            message: `Task ${isMilestone ? "marked as" : "unmarked from"} milestone`,
            data: updatedTask
        });
    }
    catch (error) {
        next(error);
    }
};
