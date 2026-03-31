import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const spaceService = require("../services/spaceService");
const AppError = require("../utils/AppError");

// @desc    Create new space
// @route   POST /api/workspaces/:workspaceId/spaces
// @access  Private
const createSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, description } = req.body;
  const { workspaceId } = req.params;

  const space = await spaceService.createSpace({
    name,
    description,
    workspace: workspaceId,
    owner: req.user!.id
  });

  res.status(201).json({
    success: true,
    data: space
  });
});

// @desc    Get all spaces in workspace
// @route   GET /api/workspaces/:workspaceId/spaces
// @access  Private
const getWorkspaceSpaces = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;

  const spaces = await spaceService.getWorkspaceSpaces(workspaceId, req.user!.id);

  res.status(200).json({
    success: true,
    count: spaces.length,
    data: spaces
  });
});

// @desc    Get single space
// @route   GET /api/spaces/:id
// @access  Private
const getSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const space = await spaceService.getSpaceById(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: space
  });
});

// @desc    Get space metadata only (fast)
// @route   GET /api/spaces/:id/metadata
// @access  Private
const getSpaceMetadata = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const space = await spaceService.getSpaceMetadataById(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: space
  });
});

// @desc    Get space lists metadata (without tasks)
// @route   GET /api/spaces/:id/lists/metadata
// @access  Private
const getSpaceListsMetadata = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const lists = await spaceService.getSpaceListsMetadata(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: lists
  });
});

// @desc    Update space
// @route   PATCH /api/spaces/:id
// @access  Private
const updateSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, description, status } = req.body;

  const space = await spaceService.updateSpace(req.params.id, req.user!.id, { name, description, status });

  res.status(200).json({
    success: true,
    data: space
  });
});

// @desc    Delete space
// @route   DELETE /api/spaces/:id
// @access  Private
const deleteSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await spaceService.deleteSpace(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Add member to space
// @route   POST /api/spaces/:id/members
// @access  Private
const addMemberToSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId, role } = req.body;
  const space = await spaceService.addMemberToSpace(req.params.id, req.user!.id, userId, role);

  res.status(200).json({
    success: true,
    data: space
  });
});

// @desc    Remove member from space
// @route   DELETE /api/spaces/:id/members/:userId
// @access  Private
const removeMemberFromSpace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const space = await spaceService.removeMemberFromSpace(req.params.id, req.user!.id, req.params.userId);

  res.status(200).json({
    success: true,
    data: space
  });
});

// @desc    Invite external users to space
// @route   POST /api/spaces/:id/invite-external
// @access  Private
const inviteExternalUsers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { invites } = req.body;
  const result = await spaceService.inviteExternalUsers(req.params.id, req.user!.id, invites);

  res.status(200).json({
    success: true,
    data: result
  });
});

module.exports = {
  createSpace,
  getWorkspaceSpaces,
  getSpace,
  getSpaceMetadata,
  getSpaceListsMetadata,
  updateSpace,
  deleteSpace,
  addMemberToSpace,
  removeMemberFromSpace,
  inviteExternalUsers
};

export {};
