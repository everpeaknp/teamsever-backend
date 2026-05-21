import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const invitationService = require("../services/invitationService");
const AppError = require("../utils/AppError");

// @desc    Send invitation to join workspace
// @route   POST /api/workspaces/:workspaceId/invites
// @access  Private (Admin/Owner only)
const sendInvite = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, role, spaceId, spacePermissionLevel, inviteType, expiresInHours } = req.body;
  const { workspaceId } = req.params;

  console.log(`[InvitationController] Received invite request for workspace ${workspaceId}:`, { 
    email, role, spaceId, spacePermissionLevel, inviteType, expiresInHours 
  });

  // For email-type invites, email is required (also enforced by validator)
  if (inviteType !== "link" && !email) {
    throw new AppError("Email is required", 400);
  }

  // Build payload without including undefined fields so tests and callers receive a minimal shape
  const payload: any = {
    email,
    workspaceId,
    role: role || "member",
    invitedBy: req.user!.id,
  };

  if (typeof inviteType !== "undefined") payload.inviteType = inviteType;
  if (typeof spaceId !== "undefined") payload.spaceId = spaceId;
  if (typeof spacePermissionLevel !== "undefined") payload.spacePermissionLevel = spacePermissionLevel;
  if (typeof expiresInHours !== "undefined") payload.expiresInHours = expiresInHours ? parseInt(expiresInHours) : undefined;

  const invitation = await invitationService.sendInvite(payload);

  const message = inviteType === "link"
    ? `Join link created successfully`
    : `Invitation sent to ${email}`;

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  // Build response data, omitting null/undefined optional fields for cleaner responses
  const responseData: any = {
    _id: invitation._id,
  };

  if (typeof invitation.inviteType !== "undefined") responseData.inviteType = invitation.inviteType;
  if (typeof invitation.spaceId !== "undefined" && invitation.spaceId !== null) responseData.spaceId = invitation.spaceId;
  if (typeof invitation.spacePermissionLevel !== "undefined" && invitation.spacePermissionLevel !== null)
    responseData.spacePermissionLevel = invitation.spacePermissionLevel;
  if (typeof invitation.expiresAt !== "undefined") responseData.expiresAt = invitation.expiresAt;

  res.status(201).json({
    success: true,
    data: responseData,
    message
  });
});

// @desc    Verify invitation token (public endpoint)
// @route   GET /api/invites/verify/:token
// @access  Public
const verifyInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { token } = req.params;

  if (!token) {
    throw new AppError("Invitation token is required", 400);
  }

  const result = await invitationService.verifyInvitation(token);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Accept invitation and join workspace
// @route   POST /api/invites/accept/:token
// @access  Private
const acceptInvite = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { token } = req.params;

  if (!token) {
    throw new AppError("Invitation token is required", 400);
  }

  const result = await invitationService.acceptInvite(token, req.user!.id);

  const message = result.alreadyMember 
    ? `You are already a member of ${result.workspace.name}`
    : `Successfully joined ${result.workspace.name}`;

  // Build accept response and omit space fields when not present
  const acceptData: any = {
    workspace: {
      _id: result.workspace._id,
      name: result.workspace.name,
      description: result.workspace.description
    },
    role: result.role,
    alreadyMember: result.alreadyMember || false
  };

  if (typeof result.spaceId !== "undefined" && result.spaceId !== null) acceptData.spaceId = result.spaceId;
  if (typeof result.spaceName !== "undefined" && result.spaceName !== null) acceptData.spaceName = result.spaceName;
  if (typeof result.spacePermissionLevel !== "undefined" && result.spacePermissionLevel !== null)
    acceptData.spacePermissionLevel = result.spacePermissionLevel;

  res.status(200).json({
    success: true,
    data: acceptData,
    message
  });
});

// @desc    Get all pending invitations for a workspace
// @route   GET /api/workspaces/:workspaceId/invites
// @access  Private (Admin/Owner only)
const getWorkspaceInvitations = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;

    const invitations = await invitationService.getWorkspaceInvitations(workspaceId);

    res.status(200).json({
      success: true,
      count: invitations.length,
      data: invitations
    });
  }
);

// @desc    Cancel/revoke an invitation
// @route   DELETE /api/workspaces/:workspaceId/invites/:invitationId
// @access  Private (Admin/Owner only)
const cancelInvitation = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId, invitationId } = req.params;

    const result = await invitationService.cancelInvitation(
      invitationId,
      req.user!.id,
      workspaceId
    );

    res.status(200).json({
      success: true,
      data: result
    });
  }
);

// @desc    Get user's pending invitations
// @route   GET /api/invites/my-invitations
// @access  Private
const getMyInvitations = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Get user's email from database
    const User = require("../models/User");
    const user = await User.findById(req.user!.id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const invitations = await invitationService.getUserInvitations(user.email);

    res.status(200).json({
      success: true,
      count: invitations.length,
      data: invitations
    });
  }
);

// @desc    Redeem invitation by short code (in-app / mobile flow)
// @route   POST /api/invites/redeem
// @access  Private
const redeemInvite = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { code } = req.body;

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    throw new AppError("Invite code is required", 400);
  }

  const result = await invitationService.redeemByShortCode(code.trim(), req.user!.id);

  const message = result.alreadyMember
    ? `You are already a member of ${result.workspace.name}`
    : `Successfully joined ${result.workspace.name}`;

  res.status(200).json({
    success: true,
    data: {
      workspace: {
        _id: result.workspace._id,
        name: result.workspace.name,
        description: result.workspace.description
      },
      role: result.role,
      alreadyMember: result.alreadyMember || false,
      spaceId: result.spaceId || null,
      spaceName: result.spaceName || null,
      spacePermissionLevel: result.spacePermissionLevel || null
    },
    message
  });
});

module.exports = {
  sendInvite,
  acceptInvite,
  redeemInvite,
  getWorkspaceInvitations,
  cancelInvitation,
  getMyInvitations,
  verifyInvitation
};

export {};
