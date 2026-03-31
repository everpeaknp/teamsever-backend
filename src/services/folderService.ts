const Folder = require("../models/Folder");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const List = require("../models/List");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");

interface CreateFolderData {
  name: string;
  color?: string;
  icon?: string;
  spaceId: string;
  userId: string;
}

interface UpdateFolderData {
  name?: string;
  color?: string;
  icon?: string;
}

class FolderService {
  async createFolder(data: CreateFolderData) {
    const { name, color, icon, spaceId, userId } = data;

    // Verify space exists
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Create folder
    const folder = await Folder.create({
      name,
      color: color || "#3b82f6",
      icon,
      spaceId
    });

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      spaceId,
      action: "CREATE",
      resourceType: "Folder",
      resourceId: folder._id.toString(),
      metadata: { name: folder.name }
    });

    return folder;
  }

  async getFolders(spaceId: string, userId: string) {
    // Import ListMember model
    const ListMember = require("../models/ListMember").ListMember;
    
    // Verify space exists
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Check if user is workspace owner or admin
    const workspaceOwnerId = typeof workspace.owner === 'string' ? workspace.owner : workspace.owner?._id?.toString();
    const isOwner = workspaceOwnerId === userId;
    const workspaceMember = workspace.members.find((m: any) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
      return memberId === userId;
    });
    const isAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    // Check if user is a space member
    const isSpaceMember = space.members?.some((m: any) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
      return memberId === userId;
    });

    // Get folders with their lists
    const folders = await Folder.find({
      spaceId,
      isDeleted: false
    }).sort("createdAt").lean();

    // Get all lists in the space WITH task counts
    const Task = require("../models/Task");
    const allListsRaw = await List.find({
      space: spaceId,
      isDeleted: false
    }).lean();
    
    // Add task counts to each list
    const allLists = await Promise.all(
      allListsRaw.map(async (list: any) => {
        const taskCount = await Task.countDocuments({ 
          list: list._id, 
          isDeleted: false 
        });
        const completedCount = await Task.countDocuments({ 
          list: list._id, 
          status: 'done',
          isDeleted: false 
        });
        
        return {
          ...list,
          taskCount,
          completedCount
        };
      })
    );

    // Determine which lists user can access
    let accessibleListIds: string[];
    
    // Only owners and admins can see all lists
    if (isOwner || isAdmin) {
      accessibleListIds = allLists.map((list: any) => list._id.toString());
    } else {
      // Get lists where user has membership
      const userListMemberships = await ListMember.find({
        user: userId,
        workspace: space.workspace
      }).select('list').lean();
      
      accessibleListIds = userListMemberships.map((lm: any) => lm.list.toString());
    }

    // Populate lists for each folder, filtering by access
    const foldersWithLists = await Promise.all(
      folders.map(async (folder: any) => {
        const folderLists = allLists.filter((list: any) => 
          list.folderId?.toString() === folder._id.toString() &&
          accessibleListIds.includes(list._id.toString())
        );

        return {
          ...folder,
          lists: folderLists
        };
      })
    );

    // Filter out folders with no accessible lists (for non-admin/owner users)
    const filteredFolders = (isOwner || isAdmin) 
      ? foldersWithLists 
      : foldersWithLists.filter((folder: any) => folder.lists.length > 0);

    return filteredFolders;
  }

  async updateFolder(folderId: string, userId: string, updateData: UpdateFolderData) {
    const folder = await Folder.findOne({
      _id: folderId,
      isDeleted: false
    });

    if (!folder) {
      throw new AppError("Folder not found", 404);
    }

    // Verify space exists
    const space = await Space.findOne({
      _id: folder.spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Update folder
    if (updateData.name) folder.name = updateData.name;
    if (updateData.color) folder.color = updateData.color;
    if (updateData.icon !== undefined) folder.icon = updateData.icon;

    await folder.save();

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      spaceId: folder.spaceId.toString(),
      action: "UPDATE",
      resourceType: "Folder",
      resourceId: folder._id.toString()
    });

    return folder;
  }

  async deleteFolder(folderId: string, userId: string) {
    const folder = await Folder.findOne({
      _id: folderId,
      isDeleted: false
    });

    if (!folder) {
      throw new AppError("Folder not found", 404);
    }

    // Verify space exists
    const space = await Space.findOne({
      _id: folder.spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Verify user has access to workspace
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Soft delete folder
    await softDelete(Folder, folderId);

    // Invalidate usage cache for workspace owner
    const EntitlementService = require('./entitlementService').default;
    EntitlementService.invalidateUsageCache(workspace.owner.toString());

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      spaceId: folder.spaceId.toString(),
      action: "DELETE",
      resourceType: "Folder",
      resourceId: folder._id.toString()
    });

    return { message: "Folder deleted successfully" };
  }
}

module.exports = new FolderService();

export {};
