"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createTaskSchema = z.object({
    body: z.object({
        title: z.string().min(1, "Task title is required").max(200, "Task title cannot exceed 200 characters"),
        description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
        status: z.enum(["todo", "inprogress", "review", "done", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.string().datetime().optional(),
        deadline: z.string().datetime().optional(),
        assignee: z.string().optional(),
        customFieldValues: z.array(z.object({
            field: z.string().min(1, "Custom field ID is required"),
            value: z.any()
        })).optional(),
        // Recurrence fields
        isRecurring: z.boolean().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
        interval: z.number().min(1).optional(),
        nextOccurrence: z.string().datetime().optional(),
        recurrenceEnd: z.string().datetime().optional()
    }).passthrough().refine((data) => {
        if (data.isRecurring) {
            return data.frequency && data.nextOccurrence;
        }
        return true;
    }, {
        message: "Recurring tasks must have frequency and nextOccurrence",
        path: ["isRecurring"]
    }),
    params: z.object({
        listId: z.string()
    }).passthrough()
}).passthrough();
const updateTaskSchema = z.object({
    body: z.object({
        title: z.string().min(1, "Task title is required").max(200, "Task title cannot exceed 200 characters").optional(),
        description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
        status: z.enum(["todo", "inprogress", "review", "done", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.string().datetime().optional(),
        deadline: z.string().datetime().optional(),
        assignee: z.string().optional(),
        assigneeId: z.string().optional(),
        customFieldValues: z.array(z.object({
            field: z.string().min(1, "Custom field ID is required"),
            value: z.any()
        })).optional(),
        // Recurrence fields
        isRecurring: z.boolean().optional(),
        frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
        interval: z.number().min(1).optional(),
        nextOccurrence: z.string().datetime().optional(),
        recurrenceEnd: z.string().datetime().optional()
    }).passthrough(),
    params: z.object({
        id: z.string()
    }).passthrough()
}).passthrough();
const createSubtaskSchema = z.object({
    body: z.object({
        title: z.string().min(1, "Subtask title is required").max(200, "Subtask title cannot exceed 200 characters"),
        description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.string().datetime().optional(),
        assignee: z.string().optional()
    }).passthrough(),
    params: z.object({
        taskId: z.string()
    }).passthrough()
}).passthrough();
const addDependencySchema = z.object({
    body: z.object({
        dependencyTaskId: z.string().min(1, "Dependency task ID is required")
    }).passthrough(),
    params: z.object({
        taskId: z.string()
    }).passthrough()
}).passthrough();
module.exports = {
    createTaskSchema,
    updateTaskSchema,
    createSubtaskSchema,
    addDependencySchema
};
