"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createListSchema = z.object({
    body: z.object({
        name: z.string().min(1, "List name is required").max(100, "List name cannot exceed 100 characters"),
        folderId: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional()
    }),
    params: z.object({
        spaceId: z.string()
    }),
    query: z.object({}).optional()
});
const updateListSchema = z.object({
    body: z.object({
        name: z.string().min(1, "List name is required").max(100, "List name cannot exceed 100 characters").optional(),
        folderId: z.string().optional().nullable(),
        color: z.string().optional()
    }),
    params: z.object({
        id: z.string()
    }),
    query: z.object({}).optional()
});
module.exports = {
    createListSchema,
    updateListSchema
};
