"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("../config/cloudinary");
const socketService_1 = __importDefault(require("./socketService"));
const Attachment = require("../models/Attachment");
const Task = require("../models/Task");
const TaskComment = require("../models/TaskComment");
const Conversation = require("../models/Conversation");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const enhancedNotificationService = require("./enhancedNotificationService");
class UploadService {
    /**
     * Upload file for task
     */
    async uploadTaskAttachment(data) {
        const { file, uploadedBy, taskId } = data;
        if (!taskId) {
            throw new AppError("Task ID is required", 400);
        }
        // Verify task exists and user has access
        const task = await Task.findById(taskId).lean();
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify workspace membership
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === uploadedBy);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get file URL and public_id from Cloudinary
        const publicId = file.public_id || file.filename;
        const fileUrl = file.secure_url || file.url;
        // Create attachment record
        const attachment = await Attachment.create({
            filename: publicId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            publicId: publicId,
            uploadedBy,
            task: taskId,
            workspace: workspace._id,
        });
        // Populate uploader info
        await attachment.populate("uploadedBy", "name email");
        // Log activity
        try {
            await logger.logActivity({
                userId: uploadedBy,
                workspaceId: workspace._id.toString(),
                action: "CREATE",
                resourceType: "Attachment",
                resourceId: attachment._id.toString(),
                metadata: {
                    taskId,
                    filename: file.originalname,
                    size: file.size,
                },
            });
        }
        catch (error) {
            console.error("[Upload] Failed to log activity:", error);
        }
        // Emit real-time event
        try {
            const { emitTaskEvent } = require("../socket/events");
            emitTaskEvent(taskId, "updated", {
                attachment: {
                    _id: attachment._id,
                    filename: attachment.originalName,
                    url: attachment.url,
                    size: attachment.size,
                    mimeType: attachment.mimeType,
                    uploadedBy: attachment.uploadedBy,
                },
            }, uploadedBy);
        }
        catch (error) {
            console.error("[Upload] Failed to emit real-time event:", error);
        }
        // Send notifications
        try {
            await enhancedNotificationService.notifyFileUpload(attachment._id.toString(), uploadedBy, "Task", taskId, file.originalname);
        }
        catch (error) {
            console.error("[Upload] Failed to send notifications:", error);
        }
        return attachment;
    }
    /**
     * Upload file for comment
     */
    async uploadCommentAttachment(data) {
        const { file, uploadedBy, commentId } = data;
        if (!commentId) {
            throw new AppError("Comment ID is required", 400);
        }
        // Verify comment exists
        const comment = await TaskComment.findById(commentId).lean();
        if (!comment) {
            throw new AppError("Comment not found", 404);
        }
        // Verify task access
        const task = await Task.findById(comment.task).lean();
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify workspace membership
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === uploadedBy);
        if (!isMember) {
            throw new AppError("You do not have access to this comment", 403);
        }
        // Get file URL and public_id from Cloudinary
        const publicId = file.public_id || file.filename;
        const fileUrl = file.secure_url || file.url;
        // Create attachment record
        const attachment = await Attachment.create({
            filename: publicId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            publicId: publicId,
            uploadedBy,
            comment: commentId,
            task: task._id,
            workspace: workspace._id,
        });
        // Populate uploader info
        await attachment.populate("uploadedBy", "name email");
        // Log activity
        try {
            await logger.logActivity({
                userId: uploadedBy,
                workspaceId: workspace._id.toString(),
                action: "CREATE",
                resourceType: "Attachment",
                resourceId: attachment._id.toString(),
                metadata: {
                    commentId,
                    taskId: task._id.toString(),
                    filename: file.originalname,
                    size: file.size,
                },
            });
        }
        catch (error) {
            console.error("[Upload] Failed to log activity:", error);
        }
        // Emit real-time event
        try {
            const { emitTaskEvent } = require("../socket/events");
            emitTaskEvent(task._id.toString(), "comment_updated", {
                commentId,
                attachment: {
                    _id: attachment._id,
                    filename: attachment.originalName,
                    url: attachment.url,
                    size: attachment.size,
                    mimeType: attachment.mimeType,
                    uploadedBy: attachment.uploadedBy,
                },
            }, uploadedBy);
        }
        catch (error) {
            console.error("[Upload] Failed to emit real-time event:", error);
        }
        // Send notifications
        try {
            await enhancedNotificationService.notifyFileUpload(attachment._id.toString(), uploadedBy, "Comment", commentId, file.originalname);
        }
        catch (error) {
            console.error("[Upload] Failed to send notifications:", error);
        }
        return attachment;
    }
    /**
     * Upload file for direct message
     */
    async uploadDMAttachment(data) {
        const { file, uploadedBy, conversationId } = data;
        if (!conversationId) {
            throw new AppError("Conversation ID is required", 400);
        }
        // Verify conversation exists and user is participant
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }
        const isParticipant = conversation.participants.some((p) => p.toString() === uploadedBy);
        if (!isParticipant) {
            throw new AppError("You do not have access to this conversation", 403);
        }
        // Get file URL and public_id from Cloudinary
        const publicId = file.public_id || file.filename;
        const fileUrl = file.secure_url || file.url;
        // Create attachment record
        const attachment = await Attachment.create({
            filename: publicId,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: fileUrl,
            publicId: publicId,
            uploadedBy,
            conversation: conversationId,
        });
        // Populate uploader info
        await attachment.populate("uploadedBy", "name email");
        // Emit real-time event to other participant
        try {
            const otherParticipant = conversation.participants.find((p) => p.toString() !== uploadedBy);
            if (otherParticipant) {
                socketService_1.default.emitToUser(otherParticipant.toString(), "dm:file:new", {
                    conversationId,
                    attachment: {
                        _id: attachment._id,
                        filename: attachment.originalName,
                        url: attachment.url,
                        size: attachment.size,
                        mimeType: attachment.mimeType,
                        uploadedBy: attachment.uploadedBy,
                    },
                });
            }
        }
        catch (error) {
            console.error("[Upload] Failed to emit real-time event:", error);
        }
        return attachment;
    }
    /**
     * Get attachments for task
     */
    async getTaskAttachments(taskId, userId) {
        // Verify task access
        const task = await Task.findById(taskId).lean();
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify workspace membership
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get attachments
        const attachments = await Attachment.find({
            task: taskId,
            isDeleted: false,
        })
            .populate("uploadedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();
        return attachments;
    }
    /**
     * Get attachments for comment
     */
    async getCommentAttachments(commentId, userId) {
        // Verify comment exists
        const comment = await TaskComment.findById(commentId).lean();
        if (!comment) {
            throw new AppError("Comment not found", 404);
        }
        // Verify task access
        const task = await Task.findById(comment.task).lean();
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify workspace membership
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this comment", 403);
        }
        // Get attachments
        const attachments = await Attachment.find({
            comment: commentId,
            isDeleted: false,
        })
            .populate("uploadedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();
        return attachments;
    }
    /**
     * Get attachments for conversation
     */
    async getConversationAttachments(conversationId, userId) {
        // Verify conversation access
        const conversation = await Conversation.findById(conversationId).lean();
        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }
        const isParticipant = conversation.participants.some((p) => p.toString() === userId);
        if (!isParticipant) {
            throw new AppError("You do not have access to this conversation", 403);
        }
        // Get attachments
        const attachments = await Attachment.find({
            conversation: conversationId,
            isDeleted: false,
        })
            .populate("uploadedBy", "name email")
            .sort({ createdAt: -1 })
            .lean();
        return attachments;
    }
    /**
     * Delete attachment
     */
    async deleteAttachment(attachmentId, userId) {
        // Find attachment
        const attachment = await Attachment.findById(attachmentId);
        if (!attachment) {
            throw new AppError("Attachment not found", 404);
        }
        // Check if user is the uploader or has admin rights
        const isUploader = attachment.uploadedBy.toString() === userId;
        if (!isUploader) {
            // Check if user is workspace admin
            if (attachment.workspace) {
                const workspace = await Workspace.findById(attachment.workspace).lean();
                if (workspace) {
                    const member = workspace.members.find((m) => m.user.toString() === userId);
                    const isAdmin = member && (member.role === "owner" || member.role === "admin");
                    if (!isAdmin) {
                        throw new AppError("You do not have permission to delete this attachment", 403);
                    }
                }
            }
            else {
                throw new AppError("You do not have permission to delete this attachment", 403);
            }
        }
        // Delete from Cloudinary
        try {
            await cloudinary_1.cloudinary.uploader.destroy(attachment.publicId, {
                resource_type: attachment.fileType || "auto",
                invalidate: true
            });
        }
        catch (error) {
            console.error("[Upload] Failed to delete file from Cloudinary:", error);
            // Continue with soft delete even if Cloudinary deletion fails
        }
        // Soft delete attachment
        attachment.isDeleted = true;
        attachment.deletedAt = new Date();
        attachment.deletedBy = userId;
        await attachment.save();
        // Log activity
        if (attachment.workspace) {
            try {
                await logger.logActivity({
                    userId,
                    workspaceId: attachment.workspace.toString(),
                    action: "DELETE",
                    resourceType: "Attachment",
                    resourceId: attachmentId,
                    metadata: {
                        filename: attachment.originalName,
                    },
                });
            }
            catch (error) {
                console.error("[Upload] Failed to log activity:", error);
            }
        }
    }
}
module.exports = new UploadService();
