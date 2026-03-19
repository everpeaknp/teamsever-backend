"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const createPlanSchema = z.object({
    body: z.object({
        name: z.string({
            required_error: "Plan name is required"
        }).min(3, "Plan name must be at least 3 characters").max(50, "Plan name must not exceed 50 characters"),
        price: z.number({
            required_error: "Price is required"
        }).min(0, "Price must be 0 or greater"),
        description: z.string({
            required_error: "Description is required"
        }).min(10, "Description must be at least 10 characters").max(500, "Description must not exceed 500 characters"),
        parentPlanId: z.string().optional().nullable(),
        features: z.object({
            maxWorkspaces: z.number().min(-1, "Max workspaces must be -1 or greater").optional(),
            maxMembers: z.number().min(-1, "Max members must be -1 or greater").optional(),
            maxAdmins: z.number().min(-1, "Max admins must be -1 or greater").optional(),
            maxSpaces: z.number().min(-1, "Max spaces must be -1 or greater").optional(),
            maxLists: z.number().min(-1, "Max lists must be -1 or greater").optional(),
            maxFolders: z.number().min(-1, "Max folders must be -1 or greater").optional(),
            maxTasks: z.number().min(-1, "Max tasks must be -1 or greater").optional(),
            hasAccessControl: z.boolean().optional(),
            hasGroupChat: z.boolean().optional(),
            messageLimit: z.number().min(-1, "Message limit must be -1 or greater").optional(),
            announcementCooldown: z.number().min(0, "Announcement cooldown must be 0 or greater").optional(),
            accessControlTier: z.enum(['basic', 'pro', 'advanced']).optional()
        }).optional(),
        isActive: z.boolean().optional()
    }).passthrough() // Allow additional fields to pass through
});
const updatePlanSchema = z.object({
    params: z.object({
        id: z.string()
    }).optional(),
    body: z.object({
        name: z.string().min(3, "Plan name must be at least 3 characters").max(50, "Plan name must not exceed 50 characters").optional(),
        price: z.number().min(0, "Price must be 0 or greater").optional(),
        description: z.string().min(10, "Description must be at least 10 characters").max(500, "Description must not exceed 500 characters").optional(),
        parentPlanId: z.string().optional().nullable(),
        features: z.object({
            maxWorkspaces: z.number().min(-1, "Max workspaces must be -1 or greater").optional(),
            maxMembers: z.number().min(-1, "Max members must be -1 or greater").optional(),
            maxAdmins: z.number().min(-1, "Max admins must be -1 or greater").optional(),
            maxSpaces: z.number().min(-1, "Max spaces must be -1 or greater").optional(),
            maxLists: z.number().min(-1, "Max lists must be -1 or greater").optional(),
            maxFolders: z.number().min(-1, "Max folders must be -1 or greater").optional(),
            maxTasks: z.number().min(-1, "Max tasks must be -1 or greater").optional(),
            hasAccessControl: z.boolean().optional(),
            hasGroupChat: z.boolean().optional(),
            messageLimit: z.number().min(-1, "Message limit must be -1 or greater").optional(),
            announcementCooldown: z.number().min(0, "Announcement cooldown must be 0 or greater").optional(),
            accessControlTier: z.enum(['basic', 'pro', 'advanced']).optional()
        }).optional(),
        isActive: z.boolean().optional()
    }).passthrough() // Allow additional fields to pass through
});
module.exports = {
    createPlanSchema,
    updatePlanSchema
};
