const List = require("../models/List");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");

interface CreateListData {
  name: string;
  space: string;
  createdBy: string;
  folderId?: string;
}

interface UpdateListData {
  name?: string;
  folderId?: string | null;
}

class ListService {
  async createList(data: CreateListData) {
    const { name, space: spaceId, createdBy, folderId } = data;

    console.log('[ListService] createList called with:', { name, spaceId, createdBy, folderId });

    // Verify space exists
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      console.error('[ListService] Space not found:', spaceId);
      throw new AppError("Space not found", 404);
    }

    console.log('[ListService] Space found:', space.name);

    // If folderId is provided, verify folder exists and belongs to this space
    if (folderId) {
      console.log('[ListService] Validating folder:', folderId);
      const Folder = require("../models/Folder");
      const folder = await Folder.findOne({
        _id: folderId,
        spaceId: spaceId,
        isDeleted: false
      });

      if (!folder) {
        console.error('[ListService] Folder not found or does not belong to space:', { folderId, spaceId });
        throw new AppError("Folder not found or does not belong to this space", 404);
      }
      console.log('[ListService] Folder validated:', folder.name);
    }

    // Verify user is workspace member (not just space member)
    const Workspace = require("../models/Workspace");
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      console.error('[ListService] Workspace not found:', space.workspace);
      throw new AppError("Workspace not found", 404);
    }

    console.log('[ListService] Workspace found:', workspace.name);

    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === createdBy
    );

    if (!isWorkspaceMember) {
      console.error('[ListService] User is not a workspace member:', { userId: createdBy, workspaceId: workspace._id });
      throw new AppError("You must be a workspace member to create a list", 403);
    }

    console.log('[ListService] User is workspace member, creating list...');

    // Create list with creator as member
    const list = await List.create({
      name,
      space: spaceId,
      workspace: space.workspace,
      createdBy,
      folderId: folderId || null,
      members: [
        {
          user: createdBy,
          role: "owner",
          permissionLevel: "FULL"
        }
      ]
    });

    // Also create ListMember document for granular permissions
    const { ListMember } = require("../models/ListMember");
    await ListMember.create({
      user: createdBy,
      list: list._id,
      folder: folderId || null,
      space: spaceId,
      workspace: space.workspace,
      permissionLevel: "FULL",
      addedBy: createdBy
    });

    console.log('[ListService] List created successfully:', list._id);

    // Log activity
    await logger.logActivity({
      userId: createdBy,
      workspaceId: space.workspace.toString(),
      action: "CREATE",
      resourceType: "List",
      resourceId: list._id.toString(),
      metadata: { name: list.name, spaceId, folderId }
    });

    // Create workspace activity
    await WorkspaceActivity.createActivity({
      workspace: space.workspace.toString(),
      user: createdBy,
      type: "list_created",
      description: `created list "${list.name}" in space "${space.name}"`,
      space: spaceId,
      list: list._id.toString(),
      metadata: { listName: list.name, spaceName: space.name }
    });

    return list;
  }

  async getSpaceLists(spaceId: string, userId: string, folderId?: string | null) {
    console.log(`[ListService] getSpaceLists called with spaceId: ${spaceId}, userId: ${userId}`);
    
    // Import ListMember and Task models
    const ListMember = require("../models/ListMember").ListMember;
    const Task = require("../models/Task");
    
    // Verify space exists
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    }).populate('workspace');

    if (!space) {
      console.error(`[ListService] Space not found with ID: ${spaceId}`);
      throw new AppError("Space not found", 404);
    }

    console.log(`[ListService] Found space: ${space.name}`);

    // Check workspace membership
    const Workspace = require("../models/Workspace");
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      console.error(`[ListService] Workspace not found with ID: ${space.workspace}`);
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isWorkspaceMember) {
      console.error(`[ListService] User ${userId} is not a workspace member`);
      throw new AppError("You do not have access to this space", 403);
    }

    // Check if user is workspace owner or admin
    const workspaceOwnerId = typeof workspace.owner === 'string' ? workspace.owner : workspace.owner?._id?.toString();
    const isOwner = workspaceOwnerId === userId;
    const workspaceMember = workspace.members.find((m: any) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
      return memberId === userId;
    });
    const isAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    console.log(`[ListService] User ${userId} access check:`, { isOwner, isAdmin });

    const query: any = {
      space: spaceId,
      isDeleted: false
    };

    if (folderId !== undefined) {
      query.folderId = folderId;
    }

    // Get all lists in the space
    const allLists = await List.find(query)
      .populate("createdBy", "name email profilePicture")
      .populate("members.user", "name email profilePicture")
      .sort("-createdAt")
      .lean();

    console.log(`[ListService] Found ${allLists.length} total lists`);
    console.log(`[ListService] All list IDs:`, allLists.map((l: any) => ({ id: l._id.toString(), name: l.name })));

    // Determine which lists to return
    let listsToReturn;
    
    // Only owners and admins can see all lists
    if (isOwner || isAdmin) {
      console.log(`[ListService] User is owner/admin, returning all ${allLists.length} lists`);
      listsToReturn = allLists;
    } else {
      // For regular members (including space members), filter to only lists where user is a list member
      const userListMemberships = await ListMember.find({
        user: userId,
        space: spaceId
      }).select('list').lean();

      const accessibleListIds = userListMemberships.map((lm: any) => lm.list.toString());
      console.log(`[ListService] User has access to ${accessibleListIds.length} lists via list membership`);
      console.log(`[ListService] Accessible list IDs:`, accessibleListIds);

      listsToReturn = allLists.filter((list: any) => 
        accessibleListIds.includes(list._id.toString())
      );

      console.log(`[ListService] Returning ${listsToReturn.length} filtered lists`);
      console.log(`[ListService] Filtered list names:`, listsToReturn.map((l: any) => l.name));
    }

    // Add task counts and list members to each list
    const listsWithCounts = await Promise.all(
      listsToReturn.map(async (list: any) => {
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

    return listsWithCounts;
  }

  async getListById(listId: string, userId: string) {
    const list = await List.findOne({
      _id: listId,
      isDeleted: false
    })
      .populate("createdBy", "name email profilePicture")
      .populate("members.user", "name email profilePicture")
      .lean();

    if (!list) {
      throw new AppError("List not found", 404);
    }

    // Verify user has access via workspace membership
    const Workspace = require("../models/Workspace");
    const workspace = await Workspace.findOne({
      _id: list.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isWorkspaceMember) {
      throw new AppError("You do not have access to this list", 403);
    }

    return list;
  }

  async updateList(listId: string, userId: string, updateData: UpdateListData) {
    const list = await List.findOne({
      _id: listId,
      isDeleted: false
    });

    if (!list) {
      throw new AppError("List not found", 404);
    }

    // Verify user is space owner or admin
    const space = await Space.findOne({
      _id: list.space,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    const member = space.members.find(
      (m: any) => m.user.toString() === userId
    );

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new AppError("Only space owner or admin can update this list", 403);
    }

    // Capture old state for audit
    const oldValue = list.toObject();

    if (updateData.name) list.name = updateData.name;
    if (updateData.folderId !== undefined) list.folderId = updateData.folderId;

    await list.save();

    // Log audit
    await logger.logAudit({
      userId,
      workspaceId: list.workspace.toString(),
      resourceType: "List",
      resourceId: list._id.toString(),
      oldValue,
      newValue: list.toObject()
    });

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: list.workspace.toString(),
      action: "UPDATE",
      resourceType: "List",
      resourceId: list._id.toString()
    });

    // Create workspace activity for name change
    if (updateData.name && oldValue.name !== updateData.name) {
      await WorkspaceActivity.createActivity({
        workspace: list.workspace.toString(),
        user: userId,
        type: "list_updated",
        description: `renamed list from "${oldValue.name}" to "${updateData.name}"`,
        space: list.space.toString(),
        list: list._id.toString(),
        metadata: { oldName: oldValue.name, newName: updateData.name }
      });
    }

    return list;
  }

  async deleteList(listId: string, userId: string) {
    const list = await List.findOne({
      _id: listId,
      isDeleted: false
    });

    if (!list) {
      throw new AppError("List not found", 404);
    }

    // Get workspace to check if user is workspace owner
    const workspace = await Workspace.findOne({
      _id: list.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Check if user is workspace owner
    const isWorkspaceOwner = workspace.owner.toString() === userId;

    // If not workspace owner, check if user is space owner or admin
    if (!isWorkspaceOwner) {
      const space = await Space.findOne({
        _id: list.space,
        isDeleted: false
      });

      if (!space) {
        throw new AppError("Space not found", 404);
      }

      const member = space.members.find(
        (m: any) => m.user.toString() === userId
      );

      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw new AppError("Only workspace owner, space owner, or space admin can delete this list", 403);
      }
    }

    // Invalidate usage cache for workspace owner
    const EntitlementService = require('./entitlementService').default;
    EntitlementService.invalidateUsageCache(workspace.owner.toString());

    await softDelete(List, listId);

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: list.workspace.toString(),
      action: "DELETE",
      resourceType: "List",
      resourceId: list._id.toString()
    });

    // Create workspace activity
    await WorkspaceActivity.createActivity({
      workspace: list.workspace.toString(),
      user: userId,
      type: "list_deleted",
      description: `deleted list "${list.name}"`,
      space: list.space.toString(),
      metadata: { listName: list.name }
    });

    return { message: "List deleted successfully" };
  }
}

module.exports = new ListService();

export {};
