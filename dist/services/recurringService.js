"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task = require("../models/Task");
const logger = require("../utils/logger");
const { emitTaskEvent } = require("../socket/events");
class RecurringService {
    /**
     * Process all recurring tasks that are due
     */
    async processRecurringTasks() {
        const result = {
            processed: 0,
            created: 0,
            errors: 0,
            details: []
        };
        try {
            console.log("[RecurringService] Starting recurring task processing...");
            // Find all recurring tasks that are due
            const now = new Date();
            const recurringTasks = await Task.find({
                isRecurring: true,
                isDeleted: false,
                nextOccurrence: { $lte: now },
                $or: [
                    { recurrenceEnd: { $exists: false } },
                    { recurrenceEnd: null },
                    { recurrenceEnd: { $gte: now } }
                ]
            }).lean();
            console.log(`[RecurringService] Found ${recurringTasks.length} recurring tasks to process`);
            for (const task of recurringTasks) {
                result.processed++;
                try {
                    // Clone the task
                    const newTask = await this.cloneTask(task);
                    // Update the original task's nextOccurrence
                    await this.updateNextOccurrence(task);
                    result.created++;
                    result.details.push({
                        taskId: task._id.toString(),
                        title: task.title,
                        success: true
                    });
                    console.log(`[RecurringService] Successfully processed recurring task: ${task.title}`);
                    // Emit real-time event for new task
                    try {
                        emitTaskEvent(newTask._id.toString(), "task_created", {
                            task: {
                                _id: newTask._id,
                                title: newTask.title,
                                status: newTask.status,
                                isRecurring: false,
                                recurringTaskId: task._id
                            }
                        }, task.createdBy.toString());
                    }
                    catch (error) {
                        // Silent fail - real-time events are non-critical
                    }
                }
                catch (error) {
                    result.errors++;
                    result.details.push({
                        taskId: task._id.toString(),
                        title: task.title,
                        success: false,
                        error: error.message
                    });
                    console.error(`[RecurringService] Error processing task ${task.title}:`, error);
                }
            }
            console.log(`[RecurringService] Processing complete. Created: ${result.created}, Errors: ${result.errors}`);
            // Log activity (removed - logger requires valid ObjectIds)
            // Activity logging for system-generated recurring tasks is handled per-task above
            return result;
        }
        catch (error) {
            console.error("[RecurringService] Fatal error in processRecurringTasks:", error);
            throw error;
        }
    }
    /**
     * Clone a recurring task
     */
    async cloneTask(originalTask) {
        const taskData = {
            title: originalTask.title,
            description: originalTask.description,
            status: "todo", // Reset to todo
            priority: originalTask.priority,
            list: originalTask.list,
            space: originalTask.space,
            workspace: originalTask.workspace,
            assignee: originalTask.assignee,
            createdBy: originalTask.createdBy,
            customFieldValues: originalTask.customFieldValues || [],
            isRecurring: false, // Cloned tasks are not recurring
            recurringTaskId: originalTask._id, // Reference to original
            dueDate: this.calculateNewDueDate(originalTask)
        };
        const newTask = await Task.create(taskData);
        console.log(`[RecurringService] Cloned task: ${originalTask.title} -> ${newTask._id}`);
        return newTask;
    }
    /**
     * Update the nextOccurrence date for a recurring task
     */
    async updateNextOccurrence(task) {
        const nextDate = this.calculateNextOccurrence(task.nextOccurrence || new Date(), task.frequency, task.interval || 1);
        await Task.findByIdAndUpdate(task._id, {
            nextOccurrence: nextDate
        });
        console.log(`[RecurringService] Updated nextOccurrence for ${task.title}: ${nextDate}`);
    }
    /**
     * Calculate the next occurrence date based on frequency and interval
     * Ensures the returned date is always in the future
     */
    calculateNextOccurrence(currentDate, frequency, interval) {
        const now = new Date();
        let date = new Date(currentDate);
        // Keep adding intervals until we get a future date
        while (date <= now) {
            switch (frequency) {
                case "daily":
                    date.setDate(date.getDate() + interval);
                    break;
                case "weekly":
                    date.setDate(date.getDate() + (interval * 7));
                    break;
                case "monthly":
                    date.setMonth(date.getMonth() + interval);
                    break;
                case "custom":
                    // For custom, treat interval as days
                    date.setDate(date.getDate() + interval);
                    break;
                default:
                    // Default to daily
                    date.setDate(date.getDate() + interval);
            }
        }
        return date;
    }
    /**
     * Calculate new due date for cloned task
     */
    calculateNewDueDate(task) {
        if (!task.dueDate) {
            return undefined;
        }
        // Calculate the difference between original dueDate and nextOccurrence
        const originalDueDate = new Date(task.dueDate);
        const nextOccurrence = new Date(task.nextOccurrence);
        // If dueDate was after nextOccurrence, maintain that offset
        const offset = originalDueDate.getTime() - nextOccurrence.getTime();
        const newNextOccurrence = this.calculateNextOccurrence(nextOccurrence, task.frequency, task.interval || 1);
        return new Date(newNextOccurrence.getTime() + offset);
    }
    /**
     * Get all recurring tasks
     */
    async getRecurringTasks(workspaceId, userId) {
        const tasks = await Task.find({
            workspace: workspaceId,
            isRecurring: true,
            isDeleted: false
        })
            .populate("assignee", "name email")
            .populate("createdBy", "name email")
            .populate("list", "name")
            .sort("nextOccurrence")
            .lean();
        return tasks;
    }
    /**
     * Get instances of a recurring task
     */
    async getRecurringTaskInstances(recurringTaskId, userId) {
        const instances = await Task.find({
            recurringTaskId: recurringTaskId,
            isDeleted: false
        })
            .populate("assignee", "name email")
            .sort("-createdAt")
            .lean();
        return instances;
    }
    /**
     * Stop a recurring task
     */
    async stopRecurringTask(taskId, userId) {
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new Error("Task not found");
        }
        if (!task.isRecurring) {
            throw new Error("Task is not a recurring task");
        }
        task.isRecurring = false;
        task.nextOccurrence = undefined;
        await task.save();
        console.log(`[RecurringService] Stopped recurring task: ${task.title}`);
        return task;
    }
}
module.exports = new RecurringService();
