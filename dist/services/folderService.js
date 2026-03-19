"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Folder = require("../models/Folder");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const List = require("../models/List");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");
class FolderService {
    async createFolder(data) {
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
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
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
    async getFolders(spaceId, userId) {
        console.log(`[FolderService] getFolders called with spaceId: ${spaceId}, userId: ${userId}`);
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
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this workspace", 403);
        }
        // Check if user is workspace owner or admin
        const workspaceOwnerId = typeof workspace.owner === 'string' ? workspace.owner : workspace.owner?._id?.toString();
        const isOwner = workspaceOwnerId === userId;
        const workspaceMember = workspace.members.find((m) => {
            const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
            return memberId === userId;
        });
        const isAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';
        // Check if user is a space member
        const isSpaceMember = space.members?.some((m) => {
            const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
            return memberId === userId;
        });
        console.log(`[FolderService] User access:`, { isOwner, isAdmin });
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
        const allLists = await Promise.all(allListsRaw.map(async (list) => {
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
        }));
        // Determine which lists user can access
        let accessibleListIds;
        // Only owners and admins can see all lists
        if (isOwner || isAdmin) {
            // Full access - can see all lists
            accessibleListIds = allLists.map((list) => list._id.toString());
            console.log(`[FolderService] User is owner/admin, has access to all ${accessibleListIds.length} lists`);
        }
        else {
            // For regular members (including space members), filter to only lists where user is a list member
            const userListMemberships = await ListMember.find({
                user: userId,
                space: spaceId
            }).select('list').lean();
            accessibleListIds = userListMemberships.map((lm) => lm.list.toString());
            console.log(`[FolderService] User has access to ${accessibleListIds.length} lists via list membership`);
        }
        // Populate lists for each folder, filtering by access
        const foldersWithLists = await Promise.all(folders.map(async (folder) => {
            const folderLists = allLists.filter((list) => list.folderId?.toString() === folder._id.toString() &&
                accessibleListIds.includes(list._id.toString()));
            console.log(`[FolderService] Folder "${folder.name}" has ${folderLists.length} accessible lists`);
            return {
                ...folder,
                lists: folderLists
            };
        }));
        // Filter out folders with no accessible lists (for non-admin/owner users)
        const filteredFolders = (isOwner || isAdmin)
            ? foldersWithLists
            : foldersWithLists.filter((folder) => folder.lists.length > 0);
        console.log(`[FolderService] Returning ${filteredFolders.length} folders`);
        console.log(`[FolderService] Folder names:`, filteredFolders.map((f) => ({ name: f.name, listCount: f.lists.length })));
        return filteredFolders;
    }
    async updateFolder(folderId, userId, updateData) {
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
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this workspace", 403);
        }
        // Update folder
        if (updateData.name)
            folder.name = updateData.name;
        if (updateData.color)
            folder.color = updateData.color;
        if (updateData.icon !== undefined)
            folder.icon = updateData.icon;
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
    async deleteFolder(folderId, userId) {
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
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
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
