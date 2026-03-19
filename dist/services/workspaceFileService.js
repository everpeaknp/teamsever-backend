"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WorkspaceFile = require("../models/WorkspaceFile");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const cloudinary = require("../config/cloudinary").default;
class WorkspaceFileService {
    /**
     * Validate workspace membership
     */
    async validateWorkspaceMembership(workspaceId, userId) {
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You must be a workspace member to access files", 403);
        }
        return workspace;
    }
    /**
     * Generate Cloudinary upload signature
     */
    async generateUploadSignature(workspaceId, userId) {
        // Validate workspace membership
        await this.validateWorkspaceMembership(workspaceId, userId);
        // Check if Cloudinary is configured
        const { isCloudinaryConfigured } = require("../config/cloudinary");
        if (!isCloudinaryConfigured()) {
            throw new AppError("Cloudinary is not configured. Please check environment variables.", 503);
        }
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = `workspace-files/${workspaceId}`;
        // Parameters to sign - must match what's sent to Cloudinary
        const paramsToSign = {
            timestamp,
            folder,
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
     * Save file after Cloudinary upload
     */
    async saveFile(data) {
        const { workspaceId, userId, secure_url, public_id, resource_type, format, bytes, fileName, fileType, } = data;
        // Validate workspace membership
        await this.validateWorkspaceMembership(workspaceId, userId);
        // Create file record
        const file = await WorkspaceFile.create({
            workspace: workspaceId,
            uploadedBy: userId,
            fileName,
            originalName: fileName,
            fileType,
            fileSize: bytes,
            cloudinaryUrl: secure_url,
            cloudinaryPublicId: public_id,
            resourceType: resource_type,
            format,
        });
        // Populate uploader info
        await file.populate("uploadedBy", "name email avatar");
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId,
                action: "CREATE",
                resourceType: "WorkspaceFile",
                resourceId: file._id.toString(),
                metadata: {
                    fileName,
                    fileSize: bytes,
                    fileType,
                },
            });
        }
        catch (error) {
            console.error("[WorkspaceFile] Failed to log activity:", error);
        }
        return file;
    }
    /**
     * Get workspace files with pagination and search
     */
    async getFiles(workspaceId, userId, options = {}) {
        // Validate workspace membership
        await this.validateWorkspaceMembership(workspaceId, userId);
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        // Build query
        const query = {
            workspace: workspaceId,
            isDeleted: false,
        };
        // Add search filter
        if (options.search) {
            query.$or = [
                { fileName: { $regex: options.search, $options: "i" } },
                { originalName: { $regex: options.search, $options: "i" } },
            ];
        }
        // Get total count
        const total = await WorkspaceFile.countDocuments(query);
        // Get files
        const files = await WorkspaceFile.find(query)
            .populate("uploadedBy", "name email avatar")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        return {
            files,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
                hasMore: page * limit < total,
            },
        };
    }
    /**
     * Get single file
     */
    async getFile(fileId, userId) {
        const file = await WorkspaceFile.findOne({
            _id: fileId,
            isDeleted: false,
        })
            .populate("uploadedBy", "name email avatar")
            .lean();
        if (!file) {
            throw new AppError("File not found", 404);
        }
        // Validate workspace membership
        await this.validateWorkspaceMembership(file.workspace.toString(), userId);
        return file;
    }
    /**
     * Delete file
     */
    async deleteFile(fileId, userId) {
        const file = await WorkspaceFile.findOne({
            _id: fileId,
            isDeleted: false,
        });
        if (!file) {
            throw new AppError("File not found", 404);
        }
        // Validate workspace membership
        const workspace = await this.validateWorkspaceMembership(file.workspace.toString(), userId);
        // Check permissions - only uploader or admin/owner can delete
        const isUploader = file.uploadedBy.toString() === userId;
        const member = workspace.members.find((m) => m.user.toString() === userId);
        const isAdmin = member && (member.role === "owner" || member.role === "admin");
        if (!isUploader && !isAdmin) {
            throw new AppError("You do not have permission to delete this file", 403);
        }
        // Soft delete
        file.isDeleted = true;
        file.deletedAt = new Date();
        await file.save();
        // Delete from Cloudinary
        try {
            await cloudinary.uploader.destroy(file.cloudinaryPublicId, {
                resource_type: file.resourceType,
            });
            console.log(`[WorkspaceFile] Deleted from Cloudinary: ${file.cloudinaryPublicId}`);
        }
        catch (error) {
            console.error("[WorkspaceFile] Failed to delete from Cloudinary:", error);
        }
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: file.workspace.toString(),
                action: "DELETE",
                resourceType: "WorkspaceFile",
                resourceId: fileId,
                metadata: {
                    fileName: file.fileName,
                },
            });
        }
        catch (error) {
            console.error("[WorkspaceFile] Failed to log activity:", error);
        }
        return { message: "File deleted successfully" };
    }
}
module.exports = new WorkspaceFileService();
