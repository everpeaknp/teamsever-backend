import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const FolderMember = require("../models/FolderMember");
const Folder = require("../models/Folder");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");

// Keep runtime-safe permission constants in controller.
// The model file uses `module.exports` for mongoose model, so enum exports are not available via require().
const FOLDER_PERMISSION_LEVELS = ["FULL", "EDIT", "COMMENT", "VIEW"] as const;

/**
 * @desc    Get all folder members with their permission levels
 * @route   GET /api/folders/:folderId/folder-members
 * @access  Private (Member or higher)
 */
const getFolderMembers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('[FolderMemberController] getFolderMembers called', { folderId: req.params.folderId });
    
    const { folderId } = req.params;

    const folder = await Folder.findById(folderId).populate("spaceId");
    if (!folder) {
      return next(new AppError("Folder not found", 404));
    }

    // Get all folder members with overrides
    const folderMembers = await FolderMember.find({ folder: folderId })
      .populate("user", "name email avatar")
      .populate("addedBy", "name")
      .lean();

    // Get workspace ID from populated spaceId
    const parentSpaceId =
      typeof folder.spaceId === "string"
        ? folder.spaceId
        : folder.spaceId?._id?.toString?.();
    const workspaceId =
      typeof folder.spaceId === "string"
        ? null
        : folder.spaceId?.workspace;

    if (!parentSpaceId) {
      return next(new AppError("Parent space not found for this folder", 404));
    }
    if (!workspaceId) {
      return next(new AppError("Workspace not found for this folder", 404));
    }

    // Get workspace to map workspace roles
    const workspace = await Workspace.findById(workspaceId).populate(
      "members.user",
      "name email avatar"
    );
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    const Space = require("../models/Space");
    const spaceDoc = await Space.findById(parentSpaceId).populate(
      "members.user",
      "name email avatar"
    );

    if (!spaceDoc) {
      return next(new AppError("Space not found", 404));
    }

    const workspaceRoleMap = new Map<string, string>();
    for (const member of workspace.members || []) {
      const memberUserId =
        typeof member.user === "string"
          ? member.user
          : member.user?._id?.toString?.();
      if (memberUserId) {
        workspaceRoleMap.set(memberUserId, member.role);
      }
    }

    const membersById = new Map<string, any>();

    // Base set: users currently inside parent space
    for (const member of (spaceDoc.members || [])) {
      const userObj = typeof member.user === "string" ? null : member.user;
      const currentUserId =
        typeof member.user === "string"
          ? member.user
          : member.user?._id?.toString?.();
      if (!currentUserId) continue;

      const override = folderMembers.find((fm: any) => {
        const overrideUserId = fm?.user?._id?.toString?.();
        const memberUserId = currentUserId?.toString?.();
        return !!overrideUserId && !!memberUserId && overrideUserId === memberUserId;
      });

      membersById.set(currentUserId, {
        _id: currentUserId,
        name: userObj?.name || "Unknown",
        email: userObj?.email || "",
        avatar: userObj?.avatar || null,
        workspaceRole: workspaceRoleMap.get(currentUserId?.toString?.() || "") || "member",
        spaceRole: member.role || "member",
        folderPermissionLevel: override?.permissionLevel || null,
        hasOverride: !!override,
        addedBy: override?.addedBy?.name || null,
        addedAt: override?.createdAt || null,
      });
    }

    // Merge explicit folder overrides even if user is not currently a parent-space member.
    // This keeps directly invited folder users visible in management UI.
    for (const override of folderMembers) {
      const overrideUserId = override?.user?._id?.toString?.();
      if (!overrideUserId || membersById.has(overrideUserId)) continue;

      membersById.set(overrideUserId, {
        _id: overrideUserId,
        name: override?.user?.name || "Unknown",
        email: override?.user?.email || "",
        avatar: override?.user?.avatar || null,
        workspaceRole: workspaceRoleMap.get(overrideUserId) || "member",
        spaceRole: "member",
        folderPermissionLevel: override?.permissionLevel || null,
        hasOverride: true,
        addedBy: override?.addedBy?.name || null,
        addedAt: override?.createdAt || null,
      });
    }

    const members = Array.from(membersById.values());

    console.log('[FolderMemberController] Members retrieved', { count: members.length });

    res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  }
);

/**
 * @desc    Add or update folder member permission override
 * @route   POST /api/folders/:folderId/folder-members
 * @access  Private (Admin or Owner)
 */
const addFolderMember = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { folderId } = req.params;
    const { userId, permissionLevel } = req.body;
    const currentUserId = req.user!.id;

    // Validate permission level
    const validLevels = [...FOLDER_PERMISSION_LEVELS];
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
      return next(
        new AppError(
          `Invalid permission level. Must be one of: ${validLevels.join(", ")}`,
          400
        )
      );
    }

    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    // Verify folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return next(new AppError("Folder not found", 404));
    }

    // Resolve workspace from folder's spaceId (Folder model has no workspace field)
    const Space = require("../models/Space");
    const space = await Space.findById(folder.spaceId).select("_id workspace");
    if (!space) {
      return next(new AppError("Space not found", 404));
    }

    // Verify user is workspace member
    const workspace = await Workspace.findById(space.workspace);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    const isWorkspaceMember = (workspace.members || []).some((m: any) => {
      const memberUserId =
        typeof m?.user === "string" ? m.user : m?.user?._id?.toString?.();
      return !!memberUserId && memberUserId === userId;
    });

    if (!isWorkspaceMember) {
      return next(
        new AppError("User must be a workspace member first", 400)
      );
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
    } else {
      // Create new override
      folderMember = await FolderMember.create({
        user: userId,
        folder: folderId,
        space: space._id,
        workspace: space.workspace,
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
  }
);

/**
 * @desc    Update folder member permission level
 * @route   PATCH /api/folders/:folderId/folder-members/:userId
 * @access  Private (Admin or Owner)
 */
const updateFolderMember = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { folderId, userId } = req.params;
    const { permissionLevel } = req.body;
    const currentUserId = req.user!.id;

    // Validate permission level
    const validLevels = [...FOLDER_PERMISSION_LEVELS];
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
      return next(
        new AppError(
          `Invalid permission level. Must be one of: ${validLevels.join(", ")}`,
          400
        )
      );
    }

    const folderMember = await FolderMember.findOne({
      user: userId,
      folder: folderId,
    });

    if (!folderMember) {
      return next(
        new AppError("Folder member override not found", 404)
      );
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
  }
);

/**
 * @desc    Remove folder member permission override
 * @route   DELETE /api/folders/:folderId/folder-members/:userId
 * @access  Private (Admin or Owner)
 */
const removeFolderMember = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { folderId, userId } = req.params;

    const folderMember = await FolderMember.findOneAndDelete({
      user: userId,
      folder: folderId,
    });

    if (!folderMember) {
      return next(
        new AppError("Folder member override not found", 404)
      );
    }

    // On folder-scope removal:
    // 1) remove list-level overrides inside this folder
    // 2) remove embedded list.members visibility entries
    // 3) transfer list ownership created by removed user to parent space owner
    const List = require("../models/List");
    const { ListMember } = require("../models/ListMember");
    const Space = require("../models/Space");

    const folder = await Folder.findById(folderId).select("spaceId");
    if (folder?.spaceId) {
      const space = await Space.findById(folder.spaceId).select("owner");
      await Promise.all([
        ListMember.deleteMany({
          user: userId,
          folder: folderId,
        }),
        List.updateMany(
          { folderId: folderId, isDeleted: false },
          { $pull: { members: { user: userId } } }
        ),
        space?.owner
          ? List.updateMany(
              { folderId: folderId, createdBy: userId, isDeleted: false },
              { $set: { createdBy: space.owner } }
            )
          : Promise.resolve(),
      ]);
    }

    res.status(200).json({
      success: true,
      message: "Folder member permission override removed successfully",
    });
  }
);

module.exports = {
  getFolderMembers,
  addFolderMember,
  updateFolderMember,
  removeFolderMember,
};

export {};
