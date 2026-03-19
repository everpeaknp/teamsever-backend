"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Attachment = require("../models/Attachment");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const { cloudinary, isCloudinaryConfigured, uploadConfig, getResourceType, getFolderPath } = require("../config/cloudinary");
const path = require("path");
class AttachmentService {
    /**
     * Generate Cloudinary signature for direct upload
     * POST /api/tasks/:taskId/attachments/init-upload
     */
    async generateUploadSignature(taskId, userId, metadata) {
        // Check if Cloudinary is configured
        if (!isCloudinaryConfigured()) {
            throw new AppError("File upload is not configured", 503);
        }
        // Verify task exists and user has access
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Validate file metadata
        this.validateFileMetadata(metadata);
        // Generate timestamp
        const timestamp = Math.round(Date.now() / 1000);
        // Determine folder based on file type
        const folder = getFolderPath(metadata.fileType);
        // Generate signature for upload
        const paramsToSign = {
            timestamp,
            folder,
            resource_type: getResourceType(metadata.fileType)
        };
        const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
        return {
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder,
        };
    }
    /**
     * Save attachment after Cloudinary upload
     * POST /api/tasks/:taskId/attachments/confirm
     */
    async saveAttachment(taskId, userId, uploadResult, metadata) {
        // Verify task exists and user has access
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Extract filename from public_id
        const filename = path.basename(uploadResult.public_id);
        // Create attachment record
        const attachment = await Attachment.create({
            filename,
            originalName: metadata.fileName,
            mimeType: metadata.fileType,
            size: uploadResult.bytes,
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            version: uploadResult.version,
            fileType: uploadResult.resource_type,
            uploadedBy: userId,
            task: taskId,
            workspace: task.workspace
        });
        // Populate uploadedBy
        await attachment.populate("uploadedBy", "name email");
        return attachment;
    }
    /**
     * Get all attachments for a task
     * GET /api/tasks/:taskId/attachments
     */
    async getTaskAttachments(taskId, userId) {
        // Verify task exists and user has access
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get attachments
        const attachments = await Attachment.getByTask(taskId);
        return attachments;
    }
    /**
     * Delete an attachment
     * DELETE /api/attachments/:attachmentId
     */
    async deleteAttachment(attachmentId, userId) {
        const attachment = await Attachment.findOne({
            _id: attachmentId,
            isDeleted: false
        });
        if (!attachment) {
            throw new AppError("Attachment not found", 404);
        }
        // Verify user has permission (uploader or workspace admin)
        const workspace = await Workspace.findOne({
            _id: attachment.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isUploader = attachment.uploadedBy.toString() === userId;
        const member = workspace.members.find((m) => m.user.toString() === userId);
        const isAdmin = member && (member.role === "owner" || member.role === "admin");
        if (!isUploader && !isAdmin) {
            throw new AppError("You do not have permission to delete this attachment", 403);
        }
        // Soft delete attachment
        await attachment.softDelete(userId);
        // Delete from Cloudinary (can be done in background job)
        if (isCloudinaryConfigured()) {
            try {
                await this.deleteFromCloudinary(attachment.publicId, attachment.fileType);
            }
            catch (error) {
                console.error(`[Attachment] Failed to delete from Cloudinary: ${attachment.publicId}`, error);
                // Don't fail the request if Cloudinary deletion fails
            }
        }
        return { message: "Attachment deleted successfully" };
    }
    /**
     * Delete all attachments for a task (called when task is hard-deleted)
     */
    async deleteTaskAttachments(taskId) {
        const attachments = await Attachment.find({
            task: taskId,
            isDeleted: false
        });
        for (const attachment of attachments) {
            // Soft delete
            attachment.isDeleted = true;
            attachment.deletedAt = new Date();
            await attachment.save();
            // Delete from Cloudinary
            if (isCloudinaryConfigured()) {
                try {
                    await this.deleteFromCloudinary(attachment.publicId, attachment.fileType);
                }
                catch (error) {
                    console.error(`[Attachment] Failed to delete from Cloudinary: ${attachment.publicId}`, error);
                }
            }
        }
        return attachments.length;
    }
    /**
     * Validate file metadata
     */
    validateFileMetadata(metadata) {
        const { fileName, fileType, fileSize } = metadata;
        // Check file name
        if (!fileName || fileName.trim().length === 0) {
            throw new AppError("File name is required", 400);
        }
        // Check file type
        if (!fileType || !uploadConfig.allowedMimeTypes.includes(fileType)) {
            throw new AppError(`File type not allowed. Allowed types: ${uploadConfig.allowedMimeTypes.join(", ")}`, 400);
        }
        // Check file extension
        const ext = path.extname(fileName).toLowerCase();
        if (!uploadConfig.allowedExtensions.includes(ext)) {
            throw new AppError(`File extension not allowed. Allowed extensions: ${uploadConfig.allowedExtensions.join(", ")}`, 400);
        }
        // Check file size
        if (!fileSize || fileSize <= 0) {
            throw new AppError("File size is required", 400);
        }
        if (fileSize > uploadConfig.maxFileSize) {
            throw new AppError(`File size exceeds maximum limit of ${uploadConfig.maxFileSize / 1024 / 1024}MB`, 400);
        }
    }
    /**
     * Delete file from Cloudinary
     */
    async deleteFromCloudinary(publicId, resourceType = "auto") {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType === "auto" ? "raw" : resourceType,
                invalidate: true
            });
            if (result.result !== "ok" && result.result !== "not found") {
                throw new Error(`Cloudinary deletion failed: ${result.result}`);
            }
            return result;
        }
        catch (error) {
            console.error("[Attachment] Cloudinary deletion error:", error);
            throw error;
        }
    }
}
module.exports = new AttachmentService();
