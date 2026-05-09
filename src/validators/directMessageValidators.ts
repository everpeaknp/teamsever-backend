const { z } = require("zod");

const sendMessageSchema = z.object({
  body: z.object({
    workspaceId: z
      .string()
      .trim()
      .min(1, "workspaceId cannot be empty")
      .optional(),
    content: z
      .string()
      .min(1, "Message content is required")
      .max(5000, "Message content too long (max 5000 characters)"),
  })
});

module.exports = {
  sendMessageSchema,
};

export {};
