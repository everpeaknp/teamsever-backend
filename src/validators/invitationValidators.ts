const { z } = require("zod");

const sendInviteSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .optional(),
    role: z
      .enum(["admin", "member"])
      .default("member"),
    inviteType: z
      .enum(["email", "link"])
      .default("email"),
    spaceId: z
      .string()
      .optional(),
    spacePermissionLevel: z
      .enum(["FULL", "EDIT", "COMMENT", "VIEW"])
      .optional()
  }).refine(
    (data) => data.inviteType === "link" || !!data.email,
    { message: "Email is required for email invitations", path: ["email"] }
  ),
  params: z.object({
    workspaceId: z.string()
  }),
  query: z.object({}).optional()
});

module.exports = {
  sendInviteSchema
};

export {};
