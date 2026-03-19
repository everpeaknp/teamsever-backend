"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const taskDependencyService = require("../services/taskDependencyService");
// @desc    Create task dependency
// @route   POST /api/task-dependencies
// @access  Private
const createDependency = asyncHandler(async (req, res, next) => {
    const { taskId, dependsOnId, type } = req.body;
    const dependency = await taskDependencyService.createDependency({
        taskId,
        dependsOnId,
        type,
        userId: req.user.id
    });
    res.status(201).json({
        success: true,
        data: dependency
    });
});
// @desc    Delete task dependency
// @route   DELETE /api/task-dependencies/:id
// @access  Private
const deleteDependency = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const result = await taskDependencyService.deleteDependency(id, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
// @desc    Get task dependencies
// @route   GET /api/task-dependencies/task/:taskId
// @access  Private
const getTaskDependencies = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const dependencies = await taskDependencyService.getTaskDependencies(taskId, req.user.id);
    res.status(200).json({
        success: true,
        count: dependencies.length,
        data: dependencies
    });
});
// @desc    Get blocking tasks
// @route   GET /api/task-dependencies/task/:taskId/blocking
// @access  Private
const getBlockingTasks = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const blockingTasks = await taskDependencyService.getBlockingTasks(taskId, req.user.id);
    res.status(200).json({
        success: true,
        count: blockingTasks.length,
        data: blockingTasks
    });
});
module.exports = {
    createDependency,
    deleteDependency,
    getTaskDependencies,
    getBlockingTasks
};
