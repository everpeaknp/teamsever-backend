const { z } = require("zod");

const createSpaceSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Space name is required").max(100, "Space name cannot exceed 100 characters"),
    description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
    color: z.string().optional()
  }).passthrough(),
  params: z.object({
    workspaceId: z.string()
  }).passthrough()
}).passthrough();

const updateSpaceSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Space name is required").max(100, "Space name cannot exceed 100 characters").optional(),
    description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
    status: z.enum(["active", "inactive"]).optional(),
    color: z.string().optional()
  }).passthrough(),
  params: z.object({
    id: z.string()
  }).passthrough()
}).passthrough();

const addMemberToSpaceSchema = z.object({
  body: z.object({
    userId: z.string(),
    role: z.enum(["admin", "member"]).optional(),
    permissionLevel: z.enum(["FULL", "EDIT", "COMMENT", "VIEW"]).optional()
  }).passthrough(),
  params: z.object({
    id: z.string()
  }).passthrough()
}).passthrough();

module.exports = {
  createSpaceSchema,
  updateSpaceSchema,
  addMemberToSpaceSchema
};

export {};
