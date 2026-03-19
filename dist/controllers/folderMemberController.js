"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const FolderMember = require("../models/FolderMember");
const Folder = require("../models/Folder");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { FolderPermissionLevel } = require("../models/FolderMember");
/**
 * @desc    Get all folder members with their permission levels
 * @route   GET /api/folders/:folderId/folder-members
 * @access  Private (Member or higher)
 */
const getFolderMembers = asyncHandler(async (req, res, next) => {
    console.log('[FolderMemberController] getFolderMembers called', { folderId: req.params.folderId });
    const { folderId } = req.params;
    const folder = await Folder.findById(folderId).populate("workspace");
    if (!folder) {
        return next(new AppError("Folder not found", 404));
    }
    // Get all folder members with overrides
    const folderMembers = await FolderMember.find({ folder: folderId })
        .populate("user", "name email avatar")
        .populate("addedBy", "name")
        .lean();
    // Get workspace to show all potential members
    const workspace = await Workspace.findById(folder.workspace).populate("members.user", "name email avatar");
    // Format response with override info
    const members = workspace.members.map((member) => {
        const override = folderMembers.find((fm) => fm.user._id.toString() === member.user._id.toString());
        return {
            _id: member.user._id,
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.avatar,
            workspaceRole: member.role,
            folderPermissionLevel: override?.permissionLevel || null,
            hasOverride: !!override,
            addedBy: override?.addedBy?.name || null,
            addedAt: override?.createdAt || null,
        };
    });
    console.log('[FolderMemberController] Members retrieved', { count: members.length });
    res.status(200).json({
        success: true,
        count: members.length,
        data: members,
    });
});
/**
 * @desc    Add or update folder member permission override
 * @route   POST /api/folders/:folderId/folder-members
 * @access  Private (Admin or Owner)
 */
const addFolderMember = asyncHandler(async (req, res, next) => {
    const { folderId } = req.params;
    const { userId, permissionLevel } = req.body;
    const currentUserId = req.user.id;
    // Validate permission level
    const validLevels = Object.values(FolderPermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    if (!userId) {
        return next(new AppError("User ID is required", 400));
    }
    // Verify folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
        return next(new AppError("Folder not found", 404));
    }
    // Verify user is workspace member
    const workspace = await Workspace.findById(folder.workspace);
    if (!workspace) {
        return next(new AppError("Workspace not found", 404));
    }
    const isWorkspaceMember = workspace.members.some((m) => m.user.toString() === userId);
    if (!isWorkspaceMember) {
        return next(new AppError("User must be a workspace member first", 400));
    }
    // Check if override already exists
    let folderMember = await FolderMember.findOne({
        user: userId,
        folder: folderId,
    });
    if (folderMember) {
        // Update existing override
        folderMember.permissionLevel = permissionLevel;
        folderMember.addedBy = currentUserId;
        await folderMember.save();
    }
    else {
        // Create new override
        folderMember = await FolderMember.create({
            user: userId,
            folder: folderId,
            space: folder.space,
            workspace: folder.workspace,
            permissionLevel,
            addedBy: currentUserId,
        });
    }
    // Populate user info
    await folderMember.populate("user", "name email avatar");
    res.status(200).json({
        success: true,
        message: "Folder member permission updated successfully",
        data: {
            _id: folderMember.user._id,
            name: folderMember.user.name,
            email: folderMember.user.email,
            avatar: folderMember.user.avatar,
            permissionLevel: folderMember.permissionLevel,
        },
    });
});
/**
 * @desc    Update folder member permission level
 * @route   PATCH /api/folders/:folderId/folder-members/:userId
 * @access  Private (Admin or Owner)
 */
const updateFolderMember = asyncHandler(async (req, res, next) => {
    const { folderId, userId } = req.params;
    const { permissionLevel } = req.body;
    const currentUserId = req.user.id;
    // Validate permission level
    const validLevels = Object.values(FolderPermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    const folderMember = await FolderMember.findOne({
        user: userId,
        folder: folderId,
    });
    if (!folderMember) {
        return next(new AppError("Folder member override not found", 404));
    }
    folderMember.permissionLevel = permissionLevel;
    folderMember.addedBy = currentUserId;
    await folderMember.save();
    await folderMember.populate("user", "name email avatar");
    res.status(200).json({
        success: true,
        message: "Folder member permission updated successfully",
        data: {
            _id: folderMember.user._id,
            name: folderMember.user.name,
            email: folderMember.user.email,
            avatar: folderMember.user.avatar,
            permissionLevel: folderMember.permissionLevel,
        },
    });
});
/**
 * @desc    Remove folder member permission override
 * @route   DELETE /api/folders/:folderId/folder-members/:userId
 * @access  Private (Admin or Owner)
 */
const removeFolderMember = asyncHandler(async (req, res, next) => {
    const { folderId, userId } = req.params;
    const folderMember = await FolderMember.findOneAndDelete({
        user: userId,
        folder: folderId,
    });
    if (!folderMember) {
        return next(new AppError("Folder member override not found", 404));
    }
    res.status(200).json({
        success: true,
        message: "Folder member permission override removed successfully",
    });
});
module.exports = {
    getFolderMembers,
    addFolderMember,
    updateFolderMember,
    removeFolderMember,
};
