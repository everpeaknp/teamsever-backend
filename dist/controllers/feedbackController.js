"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const Feedback = require("../models/Feedback");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
/**
 * @desc    Create a new feedback submission
 * @route   POST /api/feedback
 * @access  Private (Workspace admin/owner only)
 */
const createFeedback = asyncHandler(async (req, res, next) => {
    const { title, description, category, workspaceId } = req.body;
    const userId = req.user.id;
    // Fetch workspace details
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        return res.status(404).json({
            success: false,
            message: "Workspace not found"
        });
    }
    // Check if user is admin or owner of the workspace
    const isOwner = workspace.owner.toString() === userId;
    const member = workspace.members.find((m) => m.user.toString() === userId);
    const isAdmin = member && (member.role === 'admin' || member.role === 'owner');
    if (!isOwner && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: "Only workspace owners and admins can submit feedback"
        });
    }
    // Fetch user details for denormalization
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }
    // Create feedback record with all metadata
    const feedback = await Feedback.create({
        title,
        description,
        category,
        workspace: workspaceId,
        workspaceName: workspace.name,
        submittedBy: userId,
        submittedByName: user.name,
        status: 'pending'
    });
    // Return standardized success response
    res.status(201).json({
        success: true,
        data: {
            _id: feedback._id,
            title: feedback.title,
            description: feedback.description,
            category: feedback.category,
            workspace: feedback.workspace,
            workspaceName: feedback.workspaceName,
            submittedBy: feedback.submittedBy,
            submittedByName: feedback.submittedByName,
            status: feedback.status,
            createdAt: feedback.createdAt
        }
    });
});
/**
 * @desc    Get all feedback submissions (Super User only)
 * @route   GET /api/feedback
 * @access  Private (Super User only)
 */
const getAllFeedback = asyncHandler(async (req, res, next) => {
    // Verify user is super user
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    // Parse query parameters with defaults
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
    // Build query based on status filter
    let query = {};
    if (status === 'pending') {
        query.status = 'pending';
    }
    else if (status === 'resolved') {
        query.status = 'resolved';
    }
    // 'all' means no status filter
    // Calculate skip for pagination
    const skip = (page - 1) * limit;
    // Execute query with pagination and sorting
    const feedbacks = await Feedback.find(query)
        .sort({ createdAt: -1 }) // Sort by createdAt descending (reverse chronological)
        .skip(skip)
        .limit(limit);
    // Get total count for pagination metadata
    const totalItems = await Feedback.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    // Return standardized response with feedback array and pagination
    res.status(200).json({
        success: true,
        data: feedbacks,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            itemsPerPage: limit
        }
    });
});
/**
 * @desc    Mark feedback as resolved (Super User only)
 * @route   PATCH /api/feedback/:id/resolve
 * @access  Private (Super User only)
 */
const resolveFeedback = asyncHandler(async (req, res, next) => {
    // Verify user is super user
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    // Get feedback ID from route params
    const feedbackId = req.params.id;
    // Find feedback by ID
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
        return res.status(404).json({
            success: false,
            message: "Feedback not found"
        });
    }
    // Update status to 'resolved' and set resolvedAt timestamp
    feedback.status = 'resolved';
    feedback.resolvedAt = new Date();
    await feedback.save();
    // Return standardized response with updated feedback
    res.status(200).json({
        success: true,
        data: {
            _id: feedback._id,
            status: feedback.status,
            resolvedAt: feedback.resolvedAt
        }
    });
});
module.exports = {
    createFeedback,
    getAllFeedback,
    resolveFeedback
};
