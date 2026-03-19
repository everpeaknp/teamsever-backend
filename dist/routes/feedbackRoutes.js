"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { createFeedback, getAllFeedback, resolveFeedback } = require("../controllers/feedbackController");
const { createFeedbackSchema, getFeedbackSchema } = require("../validators/feedbackValidators");
const router = express.Router();
// Validation middleware that handles both body and query validation
const validate = (schema) => {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req);
            if (!result.success) {
                const zodError = result.error;
                if (!zodError || !zodError.errors || !Array.isArray(zodError.errors)) {
                    return res.status(400).json({
                        success: false,
                        message: "Validation failed"
                    });
                }
                const errors = zodError.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message
                }));
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${errors.map((e) => e.message).join(", ")}`,
                    errors
                });
            }
            // Update req with validated data (only body, query is read-only)
            if (result.data.body)
                req.body = result.data.body;
            // Don't try to set req.query as it's read-only in Express
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit feedback
 *     description: Create a new feedback submission (Workspace admin/owner only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - category
 *               - message
 *             properties:
 *               workspaceId:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [bug, feature, improvement, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Feedback created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *   get:
 *     summary: Get all feedback submissions
 *     description: Retrieve all feedback (Super User only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, resolved, rejected]
 *         description: Filter by status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [bug, feature, improvement, other]
 *         description: Filter by category
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *     responses:
 *       200:
 *         description: Feedback list retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Super user privileges required
 */
router.post("/", protect, validate(createFeedbackSchema), createFeedback);
router.get("/", protect, validate(getFeedbackSchema), getAllFeedback);
/**
 * @swagger
 * /api/feedback/{id}/resolve:
 *   patch:
 *     summary: Mark feedback as resolved
 *     description: Update feedback status to resolved (Super User only)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Feedback ID
 *     responses:
 *       200:
 *         description: Feedback resolved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Super user privileges required
 *       404:
 *         description: Feedback not found
 */
router.patch("/:id/resolve", protect, resolveFeedback);
module.exports = router;
