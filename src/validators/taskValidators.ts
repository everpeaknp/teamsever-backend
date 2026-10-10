const { z } = require("zod");

const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Task title is required").max(200, "Task title cannot exceed 200 characters"),
    workItemType: z.enum(["task", "bug"]).optional(),
    moduleId: z.string().optional(),
    qaReviewer: z.string().optional(),
    bugDetails: z.object({
      reproductionSteps: z.string().trim().min(1).max(5000),
      expectedResult: z.string().trim().min(1).max(3000),
      actualResult: z.string().trim().min(1).max(3000),
      severity: z.enum(["low", "medium", "high", "critical"]),
      environment: z.string().trim().min(1).max(500),
      build: z.string().trim().max(100).optional()
    }).optional(),
    description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
    status: z.enum(["todo", "to do", "inprogress", "in-progress", "in progress", "review", "done", "cancelled", "blocked"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    assignee: z.string().optional().nullable(),
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
  }).passthrough().refine(
    (data) => {
      if (data.isRecurring) {
        return data.frequency && data.nextOccurrence;
      }
      return true;
    },
    {
      message: "Recurring tasks must have frequency and nextOccurrence",
      path: ["isRecurring"]
    }
  ).superRefine((data: any, ctx: any) => {
    if (data.workItemType === "bug" && !data.bugDetails) {
      ctx.addIssue({ code: "custom", path: ["bugDetails"], message: "Bug details are required" });
    }
    if (data.workItemType !== "bug" && data.bugDetails) {
      ctx.addIssue({ code: "custom", path: ["bugDetails"], message: "Bug details require workItemType bug" });
    }
    if (data.workItemType === "bug" && data.status && !["todo", "to do"].includes(data.status)) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "New bugs must start Open" });
    }
  }),
  params: z.object({
    listId: z.string()
  }).passthrough()
}).passthrough();

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Task title is required").max(200, "Task title cannot exceed 200 characters").optional(),
    description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
    status: z.enum(["todo", "to do", "inprogress", "in-progress", "in progress", "review", "done", "cancelled", "blocked"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    assignee: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
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

const bugTransitionSchema = z.object({
  body: z.object({
    action: z.enum(["start", "ready_for_qa", "verify", "reopen", "close_without_fix"]),
    idempotencyKey: z.string().trim().min(1).max(100),
    reason: z.string().trim().max(2000).optional(),
    executionId: z.string().optional(),
  }),
  params: z.object({ id: z.string().min(1) }).passthrough(),
}).passthrough();

const createSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Subtask title is required").max(200, "Subtask title cannot exceed 200 characters"),
    description: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().optional(),
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
  bugTransitionSchema,
  createSubtaskSchema,
  addDependencySchema
};

export {};
