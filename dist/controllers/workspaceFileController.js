"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workspaceFileService = require("../services/workspaceFileService");
const asyncHandler = require("../utils/asyncHandler");
const EntitlementService = require("../services/entitlementService").default;
const Workspace = require("../models/Workspace");
/**
 * @desc    Generate Cloudinary upload signature
 * @route   POST /api/workspaces/:workspaceId/files/init-upload
 * @access  Private (workspace members only)
 */
const initUpload = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    console.log('\n' + '='.repeat(60));
    console.log('FILE UPLOAD INIT - DEBUG INFO');
    console.log('='.repeat(60));
    console.log('Workspace ID:', workspaceId);
    console.log('User ID:', userId);
    // Get workspace owner
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        console.log('ERROR: Workspace not found');
        console.log('='.repeat(60) + '\n');
        return res.status(404).json({
            success: false,
            message: "Workspace not found"
        });
    }
    const ownerId = workspace.owner.toString();
    console.log('Owner ID:', ownerId);
    // Check entitlement
    console.log(`[FileUpload] Checking file upload entitlement for owner: ${ownerId}`);
    const entitlement = await EntitlementService.canUploadFile(ownerId);
    console.log(`[FileUpload] Entitlement result:`, entitlement);
    console.log('='.repeat(60) + '\n');
    if (!entitlement.allowed) {
        return res.status(403).json({
            success: false,
            message: entitlement.reason || 'Cannot upload file',
            code: 'FILE_LIMIT_REACHED'
        });
    }
    const signature = await workspaceFileService.generateUploadSignature(workspaceId, userId);
    res.status(200).json({
        success: true,
        data: signature,
    });
});
/**
 * @desc    Save file after Cloudinary upload
 * @route   POST /api/workspaces/:workspaceId/files/confirm
 * @access  Private (workspace members only)
 */
const confirmUpload = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const { secure_url, public_id, resource_type, format, bytes, fileName, fileType, } = req.body;
    // Get workspace owner
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        return res.status(404).json({
            success: false,
            message: "Workspace not found"
        });
    }
    const ownerId = workspace.owner.toString();
    // Check entitlement again before saving (in case limit was reached between init and confirm)
    const entitlement = await EntitlementService.canUploadFile(ownerId);
    if (!entitlement.allowed) {
        // Delete from Cloudinary since we can't save it
        const cloudinary = require('cloudinary').v2;
        try {
            await cloudinary.uploader.destroy(public_id, {
                resource_type: resource_type,
            });
            console.log(`[WorkspaceFile] Deleted from Cloudinary due to limit: ${public_id}`);
        }
        catch (error) {
            console.error("[WorkspaceFile] Failed to delete from Cloudinary:", error);
        }
        return res.status(403).json({
            success: false,
            message: entitlement.reason || 'Cannot upload file',
            code: 'FILE_LIMIT_REACHED'
        });
    }
    const file = await workspaceFileService.saveFile({
        workspaceId,
        userId,
        secure_url,
        public_id,
        resource_type,
        format,
        bytes,
        fileName,
        fileType,
    });
    res.status(201).json({
        success: true,
        data: file,
    });
});
/**
 * @desc    Get workspace files
 * @route   GET /api/workspaces/:workspaceId/files
 * @access  Private (workspace members only)
 */
const getFiles = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const { page, limit, search } = req.query;
    const result = await workspaceFileService.getFiles(workspaceId, userId, {
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
    });
    res.status(200).json({
        success: true,
        data: result.files,
        pagination: result.pagination,
    });
});
/**
 * @desc    Get single file
 * @route   GET /api/workspace-files/:id
 * @access  Private (workspace members only)
 */
const getFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const file = await workspaceFileService.getFile(id, userId);
    res.status(200).json({
        success: true,
        data: file,
    });
});
/**
 * @desc    Delete file
 * @route   DELETE /api/workspace-files/:id
 * @access  Private (uploader or workspace admin/owner)
 */
const deleteFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await workspaceFileService.deleteFile(id, userId);
    res.status(200).json({
        success: true,
        message: result.message,
    });
});
module.exports = {
    initUpload,
    confirmUpload,
    getFiles,
    getFile,
    deleteFile,
};
