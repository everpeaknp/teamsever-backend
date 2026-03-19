const { z } = require("zod");

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(5000, "Comment content too long (max 5000 characters)"),
  mentions: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID"))
    .optional()
    .default([]),
});

const editCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(5000, "Comment content too long (max 5000 characters)"),
});

module.exports = {
  createCommentSchema,
  editCommentSchema,
};

export {};
