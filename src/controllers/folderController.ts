import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const folderService = require("../services/folderService");

// @desc    Create new folder
// @route   POST /api/spaces/:spaceId/folders
// @access  Private
const createFolder = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('[FolderController] createFolder called', { spaceId: req.params.spaceId, body: req.body });
  
  const { name, color, icon } = req.body;
  const { spaceId } = req.params;

  const folder = await folderService.createFolder({
    name,
    color,
    icon,
    spaceId,
    userId: req.user!.id
  });

  console.log('[FolderController] Folder created successfully', { folderId: folder._id });

  res.status(201).json({
    success: true,
    data: folder
  });
});

// @desc    Get all folders in space
// @route   GET /api/spaces/:spaceId/folders
// @access  Private
const getFolders = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('[FolderController] getFolders called', { spaceId: req.params.spaceId });
  
  const { spaceId } = req.params;

  const folders = await folderService.getFolders(spaceId, req.user!.id);

  console.log('[FolderController] Folders retrieved', { count: folders.length });

  res.status(200).json({
    success: true,
    data: folders
  });
});

// @desc    Get single folder
// @route   GET /api/folders/:id
// @access  Private
const getFolder = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('[FolderController] getFolder called', { folderId: req.params.id });

  const folder = await folderService.getFolderById(req.params.id, req.user!.id);

  console.log('[FolderController] Folder retrieved', { folderId: folder._id });

  res.status(200).json({
    success: true,
    data: folder
  });
});

// @desc    Update folder
// @route   PUT /api/folders/:id
// @access  Private
const updateFolder = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('[FolderController] updateFolder called', { folderId: req.params.id, body: req.body });
  
  const { name, color, icon } = req.body;

  const folder = await folderService.updateFolder(req.params.id, req.user!.id, { name, color, icon });

  console.log('[FolderController] Folder updated successfully', { folderId: folder._id });

  res.status(200).json({
    success: true,
    data: folder
  });
});

// @desc    Delete folder
// @route   DELETE /api/folders/:id
// @access  Private
const deleteFolder = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('[FolderController] deleteFolder called', { folderId: req.params.id });
  
  const result = await folderService.deleteFolder(req.params.id, req.user!.id);

  console.log('[FolderController] Folder deleted successfully', { folderId: req.params.id });

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get folder webhook details
// @route   GET /api/folders/:id/webhook
// @access  Private
const getWebhook = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  // Note: For a real enterprise implementation, you'd want to check EntitlementService.canUseWebhooksInWorkspace here
  // similar to how spaceController does it. Since we are just mirroring, we'll check folder existence.
  
  const webhookData = await folderService.getWebhook(id, req.user!.id);
  
  res.status(200).json({
    success: true,
    data: webhookData
  });
});

// @desc    Generate or update GitHub webhook secret for a folder
// @route   POST /api/folders/:id/webhook
// @access  Private
const generateWebhook = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { githubRepoName } = req.body;
  
  const webhookData = await folderService.generateWebhook(req.params.id, req.user!.id, githubRepoName);

  res.status(200).json({
    success: true,
    data: webhookData
  });
});

module.exports = {
  createFolder,
  getFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  getWebhook,
  generateWebhook
};

export {};
