const { z } = require("zod");

const sendMessageSchema = z.object({
  body: z.object({
    channelId: z.string().optional(),
    content: z.string().max(5000, "Message content too long (max 5000 characters)").trim().default(""),
    attachments: z.array(z.string().url()).max(5, "A message may contain at most 5 images").default([]),
    mentions: z.array(z.string()).optional().default([]),
  }),
  params: z.object({
    workspaceId: z.string()
  }).optional(),
  query: z.object({}).optional()
}).superRefine((request: any, ctx: any) => {
  const body = request.body;
  if (!body.content && body.attachments.length === 0) {
    ctx.addIssue({ code: "custom", path: ["body", "content"], message: "Message content or an image is required" });
  }
  for (const [index, url] of body.attachments.entries()) {
    if (!/^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//i.test(url)) {
      ctx.addIssue({ code: "custom", path: ["body", "attachments", index], message: "Only uploaded chat images are allowed" });
    }
  }
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
