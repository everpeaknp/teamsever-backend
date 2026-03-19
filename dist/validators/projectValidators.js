"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Project name is required").max(100, "Name cannot exceed 100 characters"),
        description: z.string().max(500, "Description cannot exceed 500 characters").optional()
    }),
    params: z.object({}).optional(),
    query: z.object({}).optional()
});
const updateProjectSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional()
    }),
    params: z.object({
        id: z.string()
    }),
    query: z.object({}).optional()
});
module.exports = {
    createProjectSchema,
    updateProjectSchema
};
