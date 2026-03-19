"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commentService = require("../services/commentService");
const asyncHandler = require("../utils/asyncHandler");
/**
 * @desc    Create a new comment on a task
 * @route   POST /api/tasks/:taskId/comments
 * @access  Private
 */
const createComment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { taskId } = req.params;
    const { content, mentions } = req.body;
    const comment = await commentService.createComment({
        userId,
        taskId,
        content,
        mentions,
    });
    res.status(201).json({
        success: true,
        data: comment,
        message: "Comment created successfully",
    });
});
/**
 * @desc    Get all comments for a task
 * @route   GET /api/tasks/:taskId/comments
 * @access  Private
 */
const getTaskComments = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { taskId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await commentService.getComments(taskId, userId, {
        page,
        limit,
    });
    res.status(200).json({
        success: true,
        data: result.comments,
        pagination: result.pagination,
    });
});
/**
 * @desc    Edit a comment
 * @route   PATCH /api/comments/:commentId
 * @access  Private
 */
const editComment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { commentId } = req.params;
    const { content } = req.body;
    const comment = await commentService.editComment(userId, commentId, content);
    res.status(200).json({
        success: true,
        data: comment,
        message: "Comment updated successfully",
    });
});
/**
 * @desc    Delete a comment
 * @route   DELETE /api/comments/:commentId
 * @access  Private
 */
const deleteComment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { commentId } = req.params;
    const result = await commentService.deleteComment(userId, commentId);
    res.status(200).json({
        success: true,
        data: result,
    });
});
/**
 * @desc    Get a single comment by ID
 * @route   GET /api/comments/:commentId
 * @access  Private
 */
const getComment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { commentId } = req.params;
    const comment = await commentService.getCommentById(commentId, userId);
    res.status(200).json({
        success: true,
        data: comment,
    });
});
module.exports = {
    createComment,
    getTaskComments,
    editComment,
    deleteComment,
    getComment,
};
