"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createTaskDependencySchema = z.object({
    body: z.object({
        taskId: z.string().min(1, "Task ID is required"),
        dependsOnId: z.string().min(1, "Dependency task ID is required"),
        type: z.enum(["FS", "SS", "FF", "SF"]).optional().default("FS")
    }),
    params: z.object({}).optional(),
    query: z.object({}).optional()
});
module.exports = {
    createTaskDependencySchema
};
