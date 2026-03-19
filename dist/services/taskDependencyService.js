"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TaskDependency = require("../models/TaskDependency");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { emitTaskEvent } = require("../socket/events");
class TaskDependencyService {
    /**
     * Create a task dependency
     */
    async createDependency(data) {
        const { taskId, dependsOnId, type = "FS", userId } = data;
        // Verify both tasks exist
        const [task, dependsOnTask] = await Promise.all([
            Task.findOne({ _id: taskId, isDeleted: false }),
            Task.findOne({ _id: dependsOnId, isDeleted: false })
        ]);
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        if (!dependsOnTask) {
            throw new AppError("Dependency task not found", 404);
        }
        // Validation 1: Task cannot depend on itself
        if (taskId === dependsOnId) {
            throw new AppError("A task cannot depend on itself", 400);
        }
        // Validation 2: Both tasks must belong to same workspace
        if (task.workspace.toString() !== dependsOnTask.workspace.toString()) {
            throw new AppError("Tasks must belong to the same workspace", 400);
        }
        // Validation 2b: Both tasks must belong to same project
        if (task.space.toString() !== dependsOnTask.space.toString()) {
            throw new AppError("Tasks must belong to the same project", 400);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You must be a workspace member to create dependencies", 403);
        }
        // Validation 4: Prevent duplicate dependency
        const existingDependency = await TaskDependency.findOne({
            task: taskId,
            dependsOn: dependsOnId,
            isDeleted: false
        });
        if (existingDependency) {
            throw new AppError("This dependency already exists", 400);
        }
        // Validation 3: Prevent circular dependency
        const hasCircular = await this.checkCircularDependency(dependsOnId, taskId);
        if (hasCircular) {
            throw new AppError("Cannot create dependency: This would create a circular dependency", 400);
        }
        // Create dependency
        const dependency = await TaskDependency.create({
            task: taskId,
            dependsOn: dependsOnId,
            type,
            workspace: task.workspace,
            project: task.space,
            createdBy: userId
        });
        // Populate for response
        await dependency.populate([
            { path: "task", select: "title status priority" },
            { path: "dependsOn", select: "title status priority" }
        ]);
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: task.workspace.toString(),
                action: "CREATE",
                resourceType: "TaskDependency",
                resourceId: dependency._id.toString(),
                metadata: {
                    taskId,
                    taskTitle: task.title,
                    dependsOnId,
                    dependsOnTitle: dependsOnTask.title,
                    type
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time events
        try {
            emitTaskEvent(taskId, "dependency_added", {
                dependency: {
                    _id: dependency._id,
                    type: dependency.type,
                    dependsOn: {
                        _id: dependsOnTask._id,
                        title: dependsOnTask.title,
                        status: dependsOnTask.status
                    }
                }
            }, userId);
            emitTaskEvent(dependsOnId, "dependent_added", {
                dependency: {
                    _id: dependency._id,
                    type: dependency.type,
                    task: {
                        _id: task._id,
                        title: task.title,
                        status: task.status
                    }
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return dependency;
    }
    /**
     * Delete a task dependency
     */
    async deleteDependency(dependencyId, userId) {
        const dependency = await TaskDependency.findOne({
            _id: dependencyId,
            isDeleted: false
        });
        if (!dependency) {
            throw new AppError("Dependency not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: dependency.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You must be a workspace member to delete dependencies", 403);
        }
        // Soft delete
        dependency.isDeleted = true;
        dependency.deletedAt = new Date();
        await dependency.save();
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: dependency.workspace.toString(),
                action: "DELETE",
                resourceType: "TaskDependency",
                resourceId: dependency._id.toString(),
                metadata: {
                    taskId: dependency.task.toString(),
                    dependsOnId: dependency.dependsOn.toString(),
                    type: dependency.type
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time events
        try {
            emitTaskEvent(dependency.task.toString(), "dependency_removed", {
                dependencyId: dependency._id.toString(),
                dependsOnId: dependency.dependsOn.toString()
            }, userId);
            emitTaskEvent(dependency.dependsOn.toString(), "dependent_removed", {
                dependencyId: dependency._id.toString(),
                taskId: dependency.task.toString()
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return { message: "Dependency deleted successfully" };
    }
    /**
     * Get all dependencies for a task
     */
    async getTaskDependencies(taskId, userId) {
        // Verify task exists
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get all dependencies
        const dependencies = await TaskDependency.find({
            task: taskId,
            isDeleted: false
        })
            .populate("dependsOn", "title status priority dueDate assignee")
            .populate("createdBy", "name email")
            .sort("createdAt")
            .lean();
        return dependencies;
    }
    /**
     * Get all tasks that are blocking a specific task
     */
    async getBlockingTasks(taskId, userId) {
        // Verify task exists
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get all dependencies where this task depends on others
        const dependencies = await TaskDependency.find({
            task: taskId,
            isDeleted: false
        })
            .populate("dependsOn", "title status priority dueDate assignee")
            .lean();
        // Filter to only blocking tasks based on dependency type and status
        const blockingTasks = [];
        for (const dep of dependencies) {
            const dependsOnTask = dep.dependsOn;
            if (!dependsOnTask)
                continue;
            let isBlocking = false;
            switch (dep.type) {
                case "FS": // Finish-to-Start: dependsOn must be completed
                    isBlocking = dependsOnTask.status !== "done";
                    break;
                case "SS": // Start-to-Start: dependsOn must be started
                    isBlocking = dependsOnTask.status === "todo";
                    break;
                case "FF": // Finish-to-Finish: dependsOn must be completed
                    isBlocking = dependsOnTask.status !== "done";
                    break;
                case "SF": // Start-to-Finish: dependsOn must be started
                    isBlocking = dependsOnTask.status === "todo";
                    break;
            }
            if (isBlocking) {
                blockingTasks.push({
                    ...dep,
                    reason: this.getBlockingReason(dep.type, dependsOnTask.status)
                });
            }
        }
        return blockingTasks;
    }
    /**
     * Check if a task can transition to a specific status
     */
    async canTransitionToStatus(taskId, newStatus) {
        // Get all dependencies for this task
        const dependencies = await TaskDependency.find({
            task: taskId,
            isDeleted: false
        }).populate("dependsOn", "title status");
        if (dependencies.length === 0) {
            return { allowed: true };
        }
        const blockingTasks = [];
        for (const dep of dependencies) {
            const dependsOnTask = dep.dependsOn;
            if (!dependsOnTask)
                continue;
            let isBlocked = false;
            let reason = "";
            // Check blocking based on dependency type and new status
            if (newStatus === "in-progress") {
                // Check if task can start
                if (dep.type === "FS") {
                    // Finish-to-Start: dependsOn must be completed
                    if (dependsOnTask.status !== "done") {
                        isBlocked = true;
                        reason = `Task "${dependsOnTask.title}" must be completed first (FS dependency)`;
                    }
                }
                else if (dep.type === "SS") {
                    // Start-to-Start: dependsOn must be started
                    if (dependsOnTask.status === "todo") {
                        isBlocked = true;
                        reason = `Task "${dependsOnTask.title}" must be started first (SS dependency)`;
                    }
                }
            }
            else if (newStatus === "done") {
                // Check if task can finish
                if (dep.type === "FF") {
                    // Finish-to-Finish: dependsOn must be completed
                    if (dependsOnTask.status !== "done") {
                        isBlocked = true;
                        reason = `Task "${dependsOnTask.title}" must be completed first (FF dependency)`;
                    }
                }
                else if (dep.type === "SF") {
                    // Start-to-Finish: dependsOn must be started
                    if (dependsOnTask.status === "todo") {
                        isBlocked = true;
                        reason = `Task "${dependsOnTask.title}" must be started first (SF dependency)`;
                    }
                }
                else if (dep.type === "FS") {
                    // FS also blocks completion
                    if (dependsOnTask.status !== "done") {
                        isBlocked = true;
                        reason = `Task "${dependsOnTask.title}" must be completed first (FS dependency)`;
                    }
                }
            }
            if (isBlocked) {
                blockingTasks.push({
                    dependency: dep,
                    task: dependsOnTask,
                    reason
                });
            }
        }
        if (blockingTasks.length > 0) {
            return {
                allowed: false,
                reason: `Task is blocked by ${blockingTasks.length} unfinished ${blockingTasks.length === 1 ? 'dependency' : 'dependencies'}`,
                blockingTasks
            };
        }
        return { allowed: true };
    }
    /**
     * Check for circular dependencies using DFS
     */
    async checkCircularDependency(startTaskId, targetTaskId, visited = new Set()) {
        // If we've reached the target, we have a cycle
        if (startTaskId === targetTaskId) {
            return true;
        }
        // If already visited, skip
        if (visited.has(startTaskId)) {
            return false;
        }
        visited.add(startTaskId);
        // Get all dependencies where startTask depends on others
        const dependencies = await TaskDependency.find({
            task: startTaskId,
            isDeleted: false
        }).select("dependsOn");
        if (dependencies.length === 0) {
            return false;
        }
        // Check each dependency recursively
        for (const dep of dependencies) {
            const hasCircular = await this.checkCircularDependency(dep.dependsOn.toString(), targetTaskId, visited);
            if (hasCircular) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get human-readable blocking reason
     */
    getBlockingReason(type, dependsOnStatus) {
        switch (type) {
            case "FS":
                return `Waiting for task to be completed (current: ${dependsOnStatus})`;
            case "SS":
                return `Waiting for task to be started (current: ${dependsOnStatus})`;
            case "FF":
                return `Cannot finish until task is completed (current: ${dependsOnStatus})`;
            case "SF":
                return `Cannot finish until task is started (current: ${dependsOnStatus})`;
            default:
                return "Blocked by dependency";
        }
    }
}
module.exports = new TaskDependencyService();
