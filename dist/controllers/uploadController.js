"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uploadService = require("../services/uploadService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
/**
 * Upload file for task
 * POST /api/tasks/:taskId/attachments
 */
const uploadTaskAttachment = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user.id;
    const file = req.file;
    if (!file) {
        throw new AppError("No file uploaded", 400);
    }
    const attachment = await uploadService.uploadTaskAttachment({
        file,
        uploadedBy: userId,
        taskId,
    });
    res.status(201).json({
        message: "File uploaded successfully",
        attachment,
    });
});
/**
 * Upload file for comment
 * POST /api/comments/:commentId/attachments
 */
const uploadCommentAttachment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const file = req.file;
    if (!file) {
        throw new AppError("No file uploaded", 400);
    }
    const attachment = await uploadService.uploadCommentAttachment({
        file,
        uploadedBy: userId,
        commentId,
    });
    res.status(201).json({
        message: "File uploaded successfully",
        attachment,
    });
});
/**
 * Upload file for direct message
 * POST /api/dm/:conversationId/attachments
 */
const uploadDMAttachment = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const file = req.file;
    if (!file) {
        throw new AppError("No file uploaded", 400);
    }
    const attachment = await uploadService.uploadDMAttachment({
        file,
        uploadedBy: userId,
        conversationId,
    });
    res.status(201).json({
        message: "File uploaded successfully",
        attachment,
    });
});
/**
 * Get attachments for task
 * GET /api/tasks/:taskId/attachments
 */
const getTaskAttachments = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user.id;
    const attachments = await uploadService.getTaskAttachments(taskId, userId);
    res.json({
        attachments,
        count: attachments.length,
    });
});
/**
 * Get attachments for comment
 * GET /api/comments/:commentId/attachments
 */
const getCommentAttachments = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const attachments = await uploadService.getCommentAttachments(commentId, userId);
    res.json({
        attachments,
        count: attachments.length,
    });
});
/**
 * Get attachments for conversation
 * GET /api/dm/:conversationId/attachments
 */
const getConversationAttachments = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const attachments = await uploadService.getConversationAttachments(conversationId, userId);
    res.json({
        attachments,
        count: attachments.length,
    });
});
/**
 * Delete attachment
 * DELETE /api/attachments/:attachmentId
 */
const deleteAttachment = asyncHandler(async (req, res) => {
    const { attachmentId } = req.params;
    const userId = req.user.id;
    await uploadService.deleteAttachment(attachmentId, userId);
    res.json({
        message: "Attachment deleted successfully",
    });
});
module.exports = {
    uploadTaskAttachment,
    uploadCommentAttachment,
    uploadDMAttachment,
    getTaskAttachments,
    getCommentAttachments,
    getConversationAttachments,
    deleteAttachment,
};
