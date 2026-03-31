"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const emailService = require("../services/emailService");
const asyncHandler = require("../utils/asyncHandler");
const SpaceInvitation = require("../models/SpaceInvitation");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const notificationService = require("../services/notificationService");
/**
 * @desc    Send space invitation
 * @route   POST /api/spaces/:spaceId/invitations
 * @access  Private (Admin or Owner)
 */
const sendSpaceInvitation = asyncHandler(async (req, res, next) => {
    const { spaceId } = req.params;
    const { email, permissionLevel } = req.body;
    const invitedBy = req.user.id;
    // Validate permission level
    const validLevels = ["FULL", "EDIT", "COMMENT", "VIEW"];
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    if (!email) {
        return next(new AppError("Email is required", 400));
    }
    // Verify space exists
    const space = await Space.findById(spaceId);
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    // If user exists, check if they're a workspace member
    if (user) {
        const workspace = await Workspace.findById(space.workspace);
        const isWorkspaceMember = workspace.members.some((m) => m.user.toString() === user._id.toString());
        if (!isWorkspaceMember) {
            return next(new AppError("User must be a workspace member first. Please invite them to the workspace.", 400));
        }
        // Check if already a space member
        const isSpaceMember = space.members.some((m) => {
            const memberId = typeof m.user === 'string' ? m.user : m.user?.toString();
            return memberId === user._id.toString();
        });
        if (isSpaceMember) {
            return next(new AppError("User is already a member of this space", 400));
        }
    }
    // Check for existing pending invitation
    const existingInvitation = await SpaceInvitation.findOne({
        spaceId,
        email: email.toLowerCase(),
        status: "pending"
    });
    if (existingInvitation) {
        return next(new AppError("An invitation has already been sent to this email", 400));
    }
    // Generate unique token
    const token = crypto_1.default.randomBytes(32).toString("hex");
    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const invitation = await SpaceInvitation.create({
        email: email.toLowerCase(),
        userId: user?._id || null,
        spaceId,
        workspaceId: space.workspace,
        permissionLevel,
        invitedBy,
        token,
        status: "pending",
        expiresAt
    });
    // Get inviter details
    const inviter = await User.findById(invitedBy);
    const workspace = await Workspace.findById(space.workspace);
    // Create notification for invited user (if they have an account)
    try {
        if (user) {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const invitationLink = `${frontendUrl}/accept-space-invitation/${token}`;
            await notificationService.createNotification({
                recipientId: user._id.toString(),
                type: "SPACE_INVITATION",
                title: "Space Invitation",
                body: `${inviter?.name || 'Someone'} invited you to join ${space.name} in ${workspace?.name || 'a workspace'}`,
                data: {
                    spaceId,
                    workspaceId: space.workspace,
                    token,
                    inviteUrl: invitationLink,
                    spaceName: space.name,
                    workspaceName: workspace?.name,
                    inviterName: inviter?.name,
                    permissionLevel
                },
            });
            console.log(`✅ [SpaceInvitation] Notification created for user ${user._id}`);
        }
    }
    catch (notificationError) {
        console.error(`❌ [SpaceInvitation] Failed to create notification:`, notificationError);
        // Don't fail the invitation if notification fails
    }
    // Send email notification
    try {
        const frontendUrl = process.env.FRONTEND_URL || "https://teamsever.vercel.app";
        const invitationLink = `${frontendUrl}/accept-space-invitation/${token}`;
        await emailService.sendSpaceInvitation({
            recipientEmail: email.toLowerCase(),
            recipientName: user?.name,
            inviterName: inviter?.name || 'A team member',
            spaceName: space.name,
            workspaceName: workspace?.name || 'the workspace',
            invitationLink
        });
        console.log(`✅ [SpaceInvitation] Email sent to ${email} for space ${space.name}`);
    }
    catch (emailError) {
        console.error(`❌ [SpaceInvitation] Failed to send email:`, emailError);
        // Don't fail the invitation if email fails
        // The invitation is still created and can be accessed via the app
    }
    res.status(201).json({
        success: true,
        message: "Space invitation sent successfully",
        data: {
            invitationId: invitation._id,
            email: invitation.email,
            permissionLevel: invitation.permissionLevel,
            expiresAt: invitation.expiresAt
        }
    });
});
/**
 * @desc    Get all space invitations
 * @route   GET /api/spaces/:spaceId/invitations
 * @access  Private (Admin or Owner)
 */
const getSpaceInvitations = asyncHandler(async (req, res, next) => {
    const { spaceId } = req.params;
    const invitations = await SpaceInvitation.find({
        spaceId,
        status: "pending"
    })
        .populate("invitedBy", "name email")
        .sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        count: invitations.length,
        data: invitations
    });
});
/**
 * @desc    Accept space invitation
 * @route   POST /api/space-invitations/accept/:token
 * @access  Private
 */
const acceptSpaceInvitation = asyncHandler(async (req, res, next) => {
    const { token } = req.params;
    const userId = req.user.id;
    // Find invitation
    const invitation = await SpaceInvitation.findOne({
        token,
        status: "pending"
    }).populate("spaceId");
    if (!invitation) {
        return next(new AppError("Invalid or expired invitation", 404));
    }
    // Check if invitation has expired
    if (new Date() > invitation.expiresAt) {
        invitation.status = "expired";
        await invitation.save();
        return next(new AppError("This invitation has expired", 400));
    }
    // Get user email
    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }
    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return next(new AppError("This invitation was sent to a different email address", 403));
    }
    // Verify user is workspace member
    const workspace = await Workspace.findById(invitation.workspaceId);
    const isWorkspaceMember = workspace.members.some((m) => m.user.toString() === userId);
    if (!isWorkspaceMember) {
        return next(new AppError("You must be a workspace member first", 403));
    }
    // Add user to space
    const space = await Space.findById(invitation.spaceId);
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    // Check if already a member
    const isAlreadyMember = space.members.some((m) => {
        const memberId = typeof m.user === 'string' ? m.user : m.user?.toString();
        return memberId === userId;
    });
    if (!isAlreadyMember) {
        space.members.push({
            user: userId,
            role: "member",
            joinedAt: new Date()
        });
        await space.save();
    }
    // Create space member permission override if specified
    if (invitation.permissionLevel) {
        const SpaceMember = require("../models/SpaceMember");
        const existingOverride = await SpaceMember.findOne({
            user: userId,
            space: invitation.spaceId
        });
        if (!existingOverride) {
            await SpaceMember.create({
                user: userId,
                space: invitation.spaceId,
                workspace: invitation.workspaceId,
                permissionLevel: invitation.permissionLevel,
                addedBy: invitation.invitedBy
            });
        }
    }
    // Mark invitation as accepted
    invitation.status = "accepted";
    invitation.userId = userId;
    await invitation.save();
    res.status(200).json({
        success: true,
        message: "Space invitation accepted successfully",
        data: {
            spaceId: space._id,
            spaceName: space.name,
            permissionLevel: invitation.permissionLevel
        }
    });
});
/**
 * @desc    Decline space invitation
 * @route   POST /api/space-invitations/decline/:token
 * @access  Private
 */
const declineSpaceInvitation = asyncHandler(async (req, res, next) => {
    const { token } = req.params;
    const userId = req.user.id;
    // Find invitation
    const invitation = await SpaceInvitation.findOne({
        token,
        status: "pending"
    });
    if (!invitation) {
        return next(new AppError("Invalid or expired invitation", 404));
    }
    // Get user email
    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }
    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return next(new AppError("This invitation was sent to a different email address", 403));
    }
    // Mark invitation as declined
    invitation.status = "declined";
    await invitation.save();
    res.status(200).json({
        success: true,
        message: "Space invitation declined"
    });
});
/**
 * @desc    Cancel space invitation
 * @route   DELETE /api/spaces/:spaceId/invitations/:invitationId
 * @access  Private (Admin or Owner)
 */
const cancelSpaceInvitation = asyncHandler(async (req, res, next) => {
    const { spaceId, invitationId } = req.params;
    const invitation = await SpaceInvitation.findOne({
        _id: invitationId,
        spaceId,
        status: "pending"
    });
    if (!invitation) {
        return next(new AppError("Invitation not found", 404));
    }
    await invitation.deleteOne();
    res.status(200).json({
        success: true,
        message: "Space invitation cancelled successfully"
    });
});
/**
 * @desc    Get my space invitations
 * @route   GET /api/space-invitations/my-invitations
 * @access  Private
 */
const getMySpaceInvitations = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    // Get user email
    const user = await User.findById(userId);
    if (!user) {
        return next(new AppError("User not found", 404));
    }
    // Find pending invitations for this email
    const invitations = await SpaceInvitation.find({
        email: user.email.toLowerCase(),
        status: "pending",
        expiresAt: { $gt: new Date() }
    })
        .populate("spaceId", "name description")
        .populate("workspaceId", "name")
        .populate("invitedBy", "name email")
        .sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        count: invitations.length,
        data: invitations
    });
});
module.exports = {
    sendSpaceInvitation,
    getSpaceInvitations,
    acceptSpaceInvitation,
    declineSpaceInvitation,
    cancelSpaceInvitation,
    getMySpaceInvitations
};
