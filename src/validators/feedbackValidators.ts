const { z } = require("zod");

const createFeedbackSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
    description: z.string().min(1, "Description is required").max(2000, "Description cannot exceed 2000 characters"),
    category: z.enum([
      "Bug Report",
      "Feature Request",
      "Support Question",
      "General Feedback",
      "Performance Issue"
    ], {
      errorMap: () => ({ message: "Invalid category selected" })
    }),
    workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid workspace ID format")
  })
});

const getFeedbackSchema = z.object({
  query: z.object({
    status: z.enum(["pending", "resolved", "all"]).optional(),
    page: z.string().regex(/^\d+$/, "Page must be a numeric string").optional(),
    limit: z.string().regex(/^\d+$/, "Limit must be a numeric string").optional()
  })
});

module.exports = {
  createFeedbackSchema,
  getFeedbackSchema
};

export {};
