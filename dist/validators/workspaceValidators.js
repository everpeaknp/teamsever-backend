"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createWorkspaceSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Workspace name is required").max(100, "Name cannot exceed 100 characters")
    }),
    params: z.object({}).optional(),
    query: z.object({}).optional()
});
const updateWorkspaceSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Workspace name is required").max(100, "Name cannot exceed 100 characters").optional()
    }),
    params: z.object({
        id: z.string()
    }),
    query: z.object({}).optional()
});
module.exports = {
    createWorkspaceSchema,
    updateWorkspaceSchema
};
