"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task = require("../models/Task");
const TaskDependency = require("../models/TaskDependency");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { emitTaskEvent } = require("../socket/events");
class GanttService {
    /**
     * Update task timeline and cascade changes to dependent tasks
     * @param taskId - The task whose dates changed
     * @param dateDelta - The number of milliseconds the task moved
     * @param userId - User making the change
     * @param visited - Set to prevent infinite loops (circular dependencies)
     */
    async updateTaskTimeline(taskId, dateDelta, userId, visited = new Set()) {
        const result = {
            updated: 0,
            tasks: []
        };
        // Prevent infinite loops
        if (visited.has(taskId)) {
            console.log(`[Gantt] Skipping already visited task: ${taskId}`);
            return result;
        }
        visited.add(taskId);
        try {
            // Get the task
            const task = await Task.findOne({
                _id: taskId,
                isDeleted: false
            });
            if (!task) {
                throw new AppError("Task not found", 404);
            }
            // Find all dependent tasks (tasks that depend on this task)
            // We need to update their dates based on the dependency type
            const dependencies = await TaskDependency.find({
                dependsOn: taskId,
                isDeleted: false
            }).populate("task");
            console.log(`[Gantt] Found ${dependencies.length} dependent tasks for task ${task.title}`);
            // Update each dependent task
            for (const dependency of dependencies) {
                const dependentTask = dependency.task;
                if (!dependentTask || dependentTask.isDeleted) {
                    continue;
                }
                // Skip if already visited (circular dependency protection)
                if (visited.has(dependentTask._id.toString())) {
                    console.log(`[Gantt] Skipping circular dependency: ${dependentTask.title}`);
                    continue;
                }
                const oldStartDate = dependentTask.startDate;
                const oldDueDate = dependentTask.dueDate;
                // Update dates based on dependency type
                const updated = await this.updateDependentTaskDates(dependentTask, dependency.type, dateDelta);
                if (updated) {
                    result.updated++;
                    result.tasks.push({
                        taskId: dependentTask._id.toString(),
                        title: dependentTask.title,
                        oldStartDate,
                        oldDueDate,
                        newStartDate: dependentTask.startDate,
                        newDueDate: dependentTask.dueDate
                    });
                    // Log activity (wrapped in try-catch as it's non-critical)
                    try {
                        await logger.logActivity({
                            userId,
                            workspaceId: dependentTask.workspace.toString(),
                            action: "UPDATE",
                            resourceType: "Task",
                            resourceId: dependentTask._id.toString(),
                            metadata: {
                                reason: "gantt_auto_schedule",
                                sourceTaskId: taskId,
                                dependencyType: dependency.type,
                                dateDelta
                            }
                        });
                    }
                    catch (error) {
                        // Silent fail - activity logging is non-critical
                        console.log("[Gantt] Activity logging failed (non-critical):", error.message);
                    }
                    // Emit real-time event
                    try {
                        emitTaskEvent(dependentTask._id.toString(), "timeline_updated", {
                            task: {
                                _id: dependentTask._id,
                                title: dependentTask.title,
                                startDate: dependentTask.startDate,
                                dueDate: dependentTask.dueDate
                            },
                            reason: "dependency_cascade",
                            sourceTaskId: taskId
                        }, userId);
                    }
                    catch (error) {
                        console.error("[Gantt] Failed to emit timeline_updated event:", error);
                    }
                    // Recursively update this task's dependents
                    const cascadeResult = await this.updateTaskTimeline(dependentTask._id.toString(), dateDelta, userId, visited);
                    result.updated += cascadeResult.updated;
                    result.tasks.push(...cascadeResult.tasks);
                }
            }
            return result;
        }
        catch (error) {
            console.error("[Gantt] Error in updateTaskTimeline:", error);
            throw error;
        }
    }
    /**
     * Update dependent task dates based on dependency type
     */
    async updateDependentTaskDates(dependentTask, dependencyType, dateDelta) {
        let updated = false;
        switch (dependencyType) {
            case "FS": // Finish-to-Start
                // Dependent task's start should move with predecessor's finish (dueDate)
                if (dependentTask.startDate) {
                    dependentTask.startDate = new Date(dependentTask.startDate.getTime() + dateDelta);
                    updated = true;
                }
                if (dependentTask.dueDate) {
                    dependentTask.dueDate = new Date(dependentTask.dueDate.getTime() + dateDelta);
                    updated = true;
                }
                break;
            case "SS": // Start-to-Start
                // Dependent task's start should move with predecessor's start
                if (dependentTask.startDate) {
                    dependentTask.startDate = new Date(dependentTask.startDate.getTime() + dateDelta);
                    updated = true;
                }
                if (dependentTask.dueDate) {
                    dependentTask.dueDate = new Date(dependentTask.dueDate.getTime() + dateDelta);
                    updated = true;
                }
                break;
            case "FF": // Finish-to-Finish
                // Dependent task's finish should move with predecessor's finish
                if (dependentTask.dueDate) {
                    dependentTask.dueDate = new Date(dependentTask.dueDate.getTime() + dateDelta);
                    updated = true;
                }
                if (dependentTask.startDate) {
                    dependentTask.startDate = new Date(dependentTask.startDate.getTime() + dateDelta);
                    updated = true;
                }
                break;
            case "SF": // Start-to-Finish
                // Dependent task's finish should move with predecessor's start
                if (dependentTask.dueDate) {
                    dependentTask.dueDate = new Date(dependentTask.dueDate.getTime() + dateDelta);
                    updated = true;
                }
                if (dependentTask.startDate) {
                    dependentTask.startDate = new Date(dependentTask.startDate.getTime() + dateDelta);
                    updated = true;
                }
                break;
            default:
                console.warn(`[Gantt] Unknown dependency type: ${dependencyType}`);
        }
        if (updated) {
            // Ensure milestone constraint (startDate === dueDate)
            if (dependentTask.isMilestone && dependentTask.dueDate) {
                dependentTask.startDate = dependentTask.dueDate;
            }
            await dependentTask.save();
        }
        return updated;
    }
    /**
     * Calculate date delta between old and new dates
     */
    calculateDateDelta(oldDate, newDate) {
        if (!oldDate || !newDate) {
            return 0;
        }
        return newDate.getTime() - oldDate.getTime();
    }
    /**
     * Get Gantt chart data for a project/space
     */
    async getGanttData(spaceId, userId) {
        const tasks = await Task.find({
            space: spaceId,
            isDeleted: false
        })
            .populate("assignee", "name email")
            .populate("dependencies", "title startDate dueDate status")
            .populate("dependents", "title startDate dueDate status")
            .sort("startDate")
            .lean();
        // Get all dependencies for these tasks
        const taskIds = tasks.map((t) => t._id);
        const dependencies = await TaskDependency.find({
            task: { $in: taskIds },
            isDeleted: false
        })
            .populate("task", "title")
            .populate("dependsOn", "title")
            .lean();
        // Format for Gantt chart
        const ganttTasks = tasks.map((task) => ({
            id: task._id.toString(),
            title: task.title,
            startDate: task.startDate,
            dueDate: task.dueDate,
            duration: this.calculateDuration(task.startDate, task.dueDate),
            status: task.status,
            priority: task.priority,
            assignee: task.assignee,
            isMilestone: task.isMilestone,
            dependencies: dependencies
                .filter((dep) => dep.task._id.toString() === task._id.toString())
                .map((dep) => ({
                dependsOn: dep.dependsOn._id.toString(),
                type: dep.type
            })),
            progress: this.calculateProgress(task.status)
        }));
        return ganttTasks;
    }
    /**
     * Calculate duration in days
     */
    calculateDuration(startDate, dueDate) {
        if (!startDate || !dueDate) {
            return 0;
        }
        const diff = dueDate.getTime() - startDate.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    /**
     * Calculate progress percentage based on status
     */
    calculateProgress(status) {
        switch (status) {
            case "done":
                return 100;
            case "in-progress":
                return 50;
            case "todo":
            default:
                return 0;
        }
    }
    /**
     * Validate Gantt timeline constraints
     */
    async validateTimeline(taskId) {
        const errors = [];
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            return { valid: false, errors: ["Task not found"] };
        }
        // Check milestone constraint
        if (task.isMilestone && task.startDate && task.dueDate) {
            if (task.startDate.getTime() !== task.dueDate.getTime()) {
                errors.push("Milestone must have startDate equal to dueDate (duration = 0)");
            }
        }
        // Check date order
        if (task.startDate && task.dueDate) {
            if (task.startDate.getTime() > task.dueDate.getTime()) {
                errors.push("Start date cannot be after due date");
            }
        }
        // Check dependency constraints
        const dependencies = await TaskDependency.find({
            task: taskId,
            isDeleted: false
        }).populate("dependsOn");
        for (const dependency of dependencies) {
            const predecessor = dependency.dependsOn;
            if (!predecessor || predecessor.isDeleted) {
                continue;
            }
            // Validate based on dependency type
            switch (dependency.type) {
                case "FS": // Finish-to-Start
                    if (predecessor.dueDate && task.startDate) {
                        if (task.startDate.getTime() < predecessor.dueDate.getTime()) {
                            errors.push(`Task cannot start before predecessor "${predecessor.title}" finishes (FS dependency)`);
                        }
                    }
                    break;
                case "SS": // Start-to-Start
                    if (predecessor.startDate && task.startDate) {
                        if (task.startDate.getTime() < predecessor.startDate.getTime()) {
                            errors.push(`Task cannot start before predecessor "${predecessor.title}" starts (SS dependency)`);
                        }
                    }
                    break;
                case "FF": // Finish-to-Finish
                    if (predecessor.dueDate && task.dueDate) {
                        if (task.dueDate.getTime() < predecessor.dueDate.getTime()) {
                            errors.push(`Task cannot finish before predecessor "${predecessor.title}" finishes (FF dependency)`);
                        }
                    }
                    break;
                case "SF": // Start-to-Finish
                    if (predecessor.startDate && task.dueDate) {
                        if (task.dueDate.getTime() < predecessor.startDate.getTime()) {
                            errors.push(`Task cannot finish before predecessor "${predecessor.title}" starts (SF dependency)`);
                        }
                    }
                    break;
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
module.exports = new GanttService();
