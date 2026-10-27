const { z } = require("zod");

const sendMessageSchema = z.object({
  body: z.object({
    workspaceId: z
      .string()
      .trim()
      .min(1, "workspaceId is required"),
    content: z.string().max(5000, "Message content too long (max 5000 characters)").default(""),
    attachments: z.array(z.string().url()).max(5, "A message may contain at most 5 images").default([]),
  }).superRefine((body: any, ctx: any) => {
    if (!body.content.trim() && body.attachments.length === 0) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Message content or an image is required" });
    }
    for (const [index, url] of body.attachments.entries()) {
      if (!/^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//i.test(url)) {
        ctx.addIssue({ code: "custom", path: ["attachments", index], message: "Only uploaded chat images are allowed" });
      }
    }
  })
});

module.exports = {
  sendMessageSchema,
};

export {};
