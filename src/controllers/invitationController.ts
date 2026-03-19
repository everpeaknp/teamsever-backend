import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const invitationService = require("../services/invitationService");
const AppError = require("../utils/AppError");

// @desc    Send invitation to join workspace
// @route   POST /api/workspaces/:workspaceId/invites
// @access  Private (Admin/Owner only)
const sendInvite = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, role } = req.body;
  const { workspaceId } = req.params;

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const invitation = await invitationService.sendInvite({
    email,
    workspaceId,
    role: role || "member",
    invitedBy: req.user!.id
  });

  res.status(201).json({
    success: true,
    data: invitation,
    message: `Invitation sent to ${email}`
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

  res.status(200).json({
    success: true,
    data: {
      workspace: {
        _id: result.workspace._id,
        name: result.workspace.name,
        description: result.workspace.description
      },
      role: result.role,
      alreadyMember: result.alreadyMember || false
    },
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

module.exports = {
  sendInvite,
  acceptInvite,
  getWorkspaceInvitations,
  cancelInvitation,
  getMyInvitations,
  verifyInvitation
};

export {};
