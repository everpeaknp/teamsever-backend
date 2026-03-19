"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const SpaceMember = require("../models/SpaceMember");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { SpacePermissionLevel } = require("../models/SpaceMember");
/**
 * @desc    Get all space members with their permission levels
 * @route   GET /api/spaces/:spaceId/space-members
 * @access  Private (Member or higher)
 */
const getSpaceMembers = asyncHandler(async (req, res, next) => {
    console.log('[SpaceMemberController] getSpaceMembers called', { spaceId: req.params.spaceId });
    const { spaceId } = req.params;
    const space = await Space.findById(spaceId).populate("workspace");
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    // Get all space members with overrides
    const spaceMembers = await SpaceMember.find({ space: spaceId })
        .populate("user", "name email avatar")
        .populate("addedBy", "name")
        .lean();
    // Get workspace to show all potential members
    const workspace = await Workspace.findById(space.workspace).populate("members.user", "name email avatar");
    if (!workspace) {
        return next(new AppError("Workspace not found", 404));
    }
    // Format response with override info - handle both populated and unpopulated user fields
    const members = workspace.members.map((member) => {
        // Handle case where user might be an ID string or populated object
        const userId = typeof member.user === 'string' ? member.user : member.user?._id;
        const userName = typeof member.user === 'string' ? 'Unknown' : member.user?.name || 'Unknown';
        const userEmail = typeof member.user === 'string' ? '' : member.user?.email || '';
        const userAvatar = typeof member.user === 'string' ? null : member.user?.avatar || null;
        const override = spaceMembers.find((sm) => {
            const smUserId = typeof sm.user === 'string' ? sm.user : sm.user?._id?.toString();
            return smUserId === userId?.toString();
        });
        return {
            _id: userId,
            name: userName,
            email: userEmail,
            avatar: userAvatar,
            workspaceRole: member.role,
            spacePermissionLevel: override?.permissionLevel || null,
            hasOverride: !!override,
            addedBy: override?.addedBy?.name || null,
            addedAt: override?.createdAt || null,
        };
    }).filter(member => member._id); // Filter out any members without valid IDs
    console.log('[SpaceMemberController] Members retrieved', { count: members.length });
    res.status(200).json({
        success: true,
        count: members.length,
        data: members,
    });
});
/**
 * @desc    Add or update space member permission override
 * @route   POST /api/spaces/:spaceId/space-members
 * @access  Private (Admin or Owner)
 */
const addSpaceMember = asyncHandler(async (req, res, next) => {
    const { spaceId } = req.params;
    const { userId, permissionLevel } = req.body;
    const currentUserId = req.user.id;
    // Validate permission level
    const validLevels = Object.values(SpacePermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    if (!userId) {
        return next(new AppError("User ID is required", 400));
    }
    // Verify space exists
    const space = await Space.findById(spaceId);
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    // Verify user is workspace member
    const workspace = await Workspace.findById(space.workspace);
    if (!workspace) {
        return next(new AppError("Workspace not found", 404));
    }
    const isWorkspaceMember = workspace.members.some((m) => m.user.toString() === userId);
    if (!isWorkspaceMember) {
        return next(new AppError("User must be a workspace member first", 400));
    }
    // Check if override already exists
    let spaceMember = await SpaceMember.findOne({
        user: userId,
        space: spaceId,
    });
    if (spaceMember) {
        // Update existing override
        spaceMember.permissionLevel = permissionLevel;
        spaceMember.addedBy = currentUserId;
        await spaceMember.save();
    }
    else {
        // Create new override
        spaceMember = await SpaceMember.create({
            user: userId,
            space: spaceId,
            workspace: space.workspace,
            permissionLevel,
            addedBy: currentUserId,
        });
    }
    // Populate user info
    await spaceMember.populate("user", "name email avatar");
    res.status(200).json({
        success: true,
        message: "Space member permission updated successfully",
        data: {
            _id: spaceMember.user._id,
            name: spaceMember.user.name,
            email: spaceMember.user.email,
            avatar: spaceMember.user.avatar,
            permissionLevel: spaceMember.permissionLevel,
        },
    });
});
/**
 * @desc    Update space member permission level
 * @route   PATCH /api/spaces/:spaceId/space-members/:userId
 * @access  Private (Admin or Owner)
 */
const updateSpaceMember = asyncHandler(async (req, res, next) => {
    const { spaceId, userId } = req.params;
    const { permissionLevel } = req.body;
    const currentUserId = req.user.id;
    // Validate permission level
    const validLevels = Object.values(SpacePermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    const spaceMember = await SpaceMember.findOne({
        user: userId,
        space: spaceId,
    });
    if (!spaceMember) {
        return next(new AppError("Space member override not found", 404));
    }
    spaceMember.permissionLevel = permissionLevel;
    spaceMember.addedBy = currentUserId;
    await spaceMember.save();
    await spaceMember.populate("user", "name email avatar");
    res.status(200).json({
        success: true,
        message: "Space member permission updated successfully",
        data: {
            _id: spaceMember.user._id,
            name: spaceMember.user.name,
            email: spaceMember.user.email,
            avatar: spaceMember.user.avatar,
            permissionLevel: spaceMember.permissionLevel,
        },
    });
});
/**
 * @desc    Remove space member permission override
 * @route   DELETE /api/spaces/:spaceId/space-members/:userId
 * @access  Private (Admin or Owner)
 */
const removeSpaceMember = asyncHandler(async (req, res, next) => {
    const { spaceId, userId } = req.params;
    const spaceMember = await SpaceMember.findOneAndDelete({
        user: userId,
        space: spaceId,
    });
    if (!spaceMember) {
        return next(new AppError("Space member override not found", 404));
    }
    res.status(200).json({
        success: true,
        message: "Space member permission override removed successfully",
    });
});
module.exports = {
    getSpaceMembers,
    addSpaceMember,
    updateSpaceMember,
    removeSpaceMember,
};
