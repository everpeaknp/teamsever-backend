"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { z } = require("zod");
const sendMessageSchema = z.object({
    content: z
        .string()
        .min(1, "Message content is required")
        .max(5000, "Message content too long (max 5000 characters)")
        .trim(),
    mentions: z.array(z.string()).optional().default([]),
});
module.exports = {
    sendMessageSchema,
};
