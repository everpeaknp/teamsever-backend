"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const taskService = require("../services/taskService");
const AppError = require("../utils/AppError");
// @desc    Create new task
// @route   POST /api/lists/:listId/tasks
// @access  Private
const createTask = asyncHandler(async (req, res, next) => {
    const { title, description, priority, dueDate, deadline, assignee } = req.body;
    const { listId } = req.params;
    const task = await taskService.createTask({
        title,
        description,
        priority,
        dueDate,
        deadline,
        list: listId,
        assignee,
        createdBy: req.user.id
    });
    res.status(201).json({
        success: true,
        data: task
    });
});
// @desc    Get all tasks in list
// @route   GET /api/lists/:listId/tasks
// @access  Private
const getListTasks = asyncHandler(async (req, res, next) => {
    const { listId } = req.params;
    const { status, priority, assignee } = req.query;
    const tasks = await taskService.getListTasks(listId, req.user.id, {
        status,
        priority,
        assignee
    });
    res.status(200).json({
        success: true,
        count: tasks.length,
        data: tasks
    });
});
// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = asyncHandler(async (req, res, next) => {
    const task = await taskService.getTaskById(req.params.id, req.user.id);
    res.status(200).json({
        success: true,
        data: task
    });
});
// @desc    Update task
// @route   PATCH /api/tasks/:id
// @access  Private
const updateTask = asyncHandler(async (req, res, next) => {
    const { title, description, status, priority, dueDate, deadline, assignee } = req.body;
    const task = await taskService.updateTask(req.params.id, req.user.id, {
        title,
        description,
        status,
        priority,
        dueDate,
        deadline,
        assignee
    });
    res.status(200).json({
        success: true,
        data: task
    });
});
// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = asyncHandler(async (req, res, next) => {
    const result = await taskService.deleteTask(req.params.id, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
// @desc    Create subtask
// @route   POST /api/tasks/:taskId/subtasks
// @access  Private
const createSubtask = asyncHandler(async (req, res, next) => {
    const { title, description, priority, dueDate, assignee } = req.body;
    const { taskId } = req.params;
    const subtask = await taskService.createSubtask(taskId, req.user.id, {
        title,
        description,
        priority,
        dueDate,
        assignee,
        list: "", // Will be inherited from parent
        createdBy: req.user.id
    });
    res.status(201).json({
        success: true,
        data: subtask
    });
});
// @desc    Get all subtasks of a task
// @route   GET /api/tasks/:taskId/subtasks
// @access  Private
const getSubtasks = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const subtasks = await taskService.getSubtasks(taskId, req.user.id);
    res.status(200).json({
        success: true,
        count: subtasks.length,
        data: subtasks
    });
});
// @desc    Add dependency to task
// @route   POST /api/tasks/:taskId/dependencies
// @access  Private
const addDependency = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const { dependencyTaskId } = req.body;
    const result = await taskService.addDependency(taskId, dependencyTaskId, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
// @desc    Remove dependency from task
// @route   DELETE /api/tasks/:taskId/dependencies/:depId
// @access  Private
const removeDependency = asyncHandler(async (req, res, next) => {
    const { taskId, depId } = req.params;
    const result = await taskService.removeDependency(taskId, depId, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
// @desc    Get task dependencies (blockers)
// @route   GET /api/tasks/:taskId/dependencies
// @access  Private
const getDependencies = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const dependencies = await taskService.getDependencies(taskId, req.user.id);
    res.status(200).json({
        success: true,
        count: dependencies.length,
        data: dependencies
    });
});
// @desc    Get task dependents (blocked tasks)
// @route   GET /api/tasks/:taskId/dependents
// @access  Private
const getDependents = asyncHandler(async (req, res, next) => {
    const { taskId } = req.params;
    const dependents = await taskService.getDependents(taskId, req.user.id);
    res.status(200).json({
        success: true,
        count: dependents.length,
        data: dependents
    });
});
module.exports = {
    createTask,
    getListTasks,
    getTask,
    updateTask,
    deleteTask,
    createSubtask,
    getSubtasks,
    addDependency,
    removeDependency,
    getDependencies,
    getDependents
};
