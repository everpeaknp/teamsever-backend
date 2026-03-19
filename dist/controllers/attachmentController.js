"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const attachmentService = require("../services/attachmentService");
const asyncHandler = require("../utils/asyncHandler");
/**
 * Generate Cloudinary upload signature
 * POST /api/tasks/:taskId/attachments/init-upload
 */
const initializeUpload = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { fileName, fileType, fileSize } = req.body;
    const userId = req.user.id;
    const result = await attachmentService.generateUploadSignature(taskId, userId, {
        fileName,
        fileType,
        fileSize
    });
    res.status(200).json({
        success: true,
        data: result
    });
});
/**
 * Save attachment after Cloudinary upload
 * POST /api/tasks/:taskId/attachments/confirm
 */
const confirmUpload = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { secure_url, public_id, version, resource_type, format, bytes, fileName, fileType } = req.body;
    const userId = req.user.id;
    // Validate required Cloudinary response fields
    if (!secure_url || !public_id || !bytes) {
        return res.status(400).json({
            success: false,
            error: "Missing required Cloudinary upload data"
        });
    }
    const attachment = await attachmentService.saveAttachment(taskId, userId, {
        secure_url,
        public_id,
        version: version || 1,
        resource_type: resource_type || "auto",
        format: format || "",
        bytes
    }, {
        fileName: fileName || public_id,
        fileType: fileType || "application/octet-stream",
        fileSize: bytes
    });
    res.status(201).json({
        success: true,
        data: attachment
    });
});
/**
 * Get all attachments for a task
 * GET /api/tasks/:taskId/attachments
 */
const getTaskAttachments = asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const userId = req.user.id;
    const attachments = await attachmentService.getTaskAttachments(taskId, userId);
    res.status(200).json({
        success: true,
        count: attachments.length,
        data: attachments
    });
});
/**
 * Delete an attachment
 * DELETE /api/attachments/:attachmentId
 */
const deleteAttachment = asyncHandler(async (req, res) => {
    const { attachmentId } = req.params;
    const userId = req.user.id;
    const result = await attachmentService.deleteAttachment(attachmentId, userId);
    res.status(200).json({
        success: true,
        message: result.message
    });
});
module.exports = {
    initializeUpload,
    confirmUpload,
    getTaskAttachments,
    deleteAttachment
};
