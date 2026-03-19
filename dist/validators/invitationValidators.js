"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const sendInviteSchema = z.object({
    body: z.object({
        email: z
            .string()
            .email("Please provide a valid email address")
            .min(1, "Email is required")
            .toLowerCase(),
        role: z
            .enum(["admin", "member"])
            .default("member")
    }),
    params: z.object({
        workspaceId: z.string()
    }),
    query: z.object({}).optional()
});
module.exports = {
    sendInviteSchema
};
