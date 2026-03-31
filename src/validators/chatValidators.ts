const { z } = require("zod");

const sendMessageSchema = z.object({
  body: z.object({
    channelId: z.string().optional(),
    content: z
      .string()
      .min(1, "Message content is required")
      .max(5000, "Message content too long (max 5000 characters)")
      .trim(),
    mentions: z.array(z.string()).optional().default([]),
  }),
  params: z.object({
    workspaceId: z.string()
  }).optional(),
  query: z.object({}).optional()
});

const createChannelSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Channel name is required")
      .max(100, "Name too long")
      .trim(),
    description: z.string().max(500).optional(),
    type: z.enum(["public", "private"]).default("public"),
    members: z.array(z.string()).optional().default([]),
  }),
  params: z.object({
    workspaceId: z.string()
  }).optional(),
  query: z.object({}).optional()
});

module.exports = {
  sendMessageSchema,
  createChannelSchema,
};

export {};
