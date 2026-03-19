"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const Task = require("../models/Task");
/**
 * Access Control Service
 * Handles granular permissions for Workspace > Space > List > Task hierarchy
 */
class AccessControlService {
    /**
     * Check if user has access to workspace
     */
    async hasWorkspaceAccess(userId, workspaceId) {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace)
            return false;
        const member = workspace.members.find((m) => m.user.toString() === userId);
        return !!member;
    }
    /**
     * Check if user has access to space
     * Access granted if:
     * 1. User is workspace owner/admin
     * 2. User is in space members array
     */
    async hasSpaceAccess(userId, spaceId) {
        const space = await Space.findById(spaceId);
        if (!space)
            return false;
        // Check workspace-level access
        const workspace = await Workspace.findById(space.workspace);
        if (!workspace)
            return false;
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return false;
        // Workspace owners and admins have access to all spaces
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return true;
        }
        // Check space-level access
        const spaceMember = space.members.find((m) => m.user.toString() === userId);
        return !!spaceMember;
    }
    /**
     * Check if user has access to list
     * Access granted if:
     * 1. User is workspace owner/admin
     * 2. User is in space members array
     * 3. User is in list members array
     */
    async hasListAccess(userId, listId) {
        const list = await List.findById(listId);
        if (!list)
            return false;
        // Check workspace-level access
        const workspace = await Workspace.findById(list.workspace);
        if (!workspace)
            return false;
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return false;
        // Workspace owners and admins have access to all lists
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return true;
        }
        // Check space-level access
        const space = await Space.findById(list.space);
        if (!space)
            return false;
        const spaceMember = space.members.find((m) => m.user.toString() === userId);
        if (spaceMember) {
            return true;
        }
        // Check list-level access
        const listMember = list.members?.find((m) => m.user.toString() === userId);
        return !!listMember;
    }
    /**
     * Check if user has access to task
     * Access granted if:
     * 1. User is workspace owner/admin
     * 2. User is in space members array
     * 3. User is in list members array
     * 4. User is assigned to the task
     */
    async hasTaskAccess(userId, taskId) {
        const task = await Task.findById(taskId);
        if (!task)
            return false;
        // Check if user is assigned to the task
        if (task.assignee && task.assignee.toString() === userId) {
            return true;
        }
        // Check workspace-level access
        const workspace = await Workspace.findById(task.workspace);
        if (!workspace)
            return false;
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return false;
        // Workspace owners and admins have access to all tasks
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return true;
        }
        // Check space-level access
        const space = await Space.findById(task.space);
        if (!space)
            return false;
        const spaceMember = space.members.find((m) => m.user.toString() === userId);
        if (spaceMember) {
            return true;
        }
        // Check list-level access
        const list = await List.findById(task.list);
        if (!list)
            return false;
        const listMember = list.members?.find((m) => m.user.toString() === userId);
        return !!listMember;
    }
    /**
     * Get all spaces user has access to in a workspace
     */
    async getUserSpaces(userId, workspaceId) {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace)
            return [];
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return [];
        // Workspace owners and admins see all spaces
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return await Space.find({ workspace: workspaceId, isDeleted: false });
        }
        // Regular members only see spaces they're added to
        return await Space.find({
            workspace: workspaceId,
            isDeleted: false,
            'members.user': userId
        });
    }
    /**
     * Get all lists user has access to in a space
     */
    async getUserLists(userId, spaceId) {
        const space = await Space.findById(spaceId);
        if (!space)
            return [];
        const workspace = await Workspace.findById(space.workspace);
        if (!workspace)
            return [];
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return [];
        // Workspace owners and admins see all lists
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return await List.find({ space: spaceId, isDeleted: false });
        }
        // Check if user is space member
        const spaceMember = space.members.find((m) => m.user.toString() === userId);
        if (spaceMember) {
            return await List.find({ space: spaceId, isDeleted: false });
        }
        // Regular members only see lists they're added to
        return await List.find({
            space: spaceId,
            isDeleted: false,
            'members.user': userId
        });
    }
    /**
     * Get all tasks user has access to in a list
     */
    async getUserTasks(userId, listId) {
        const list = await List.findById(listId);
        if (!list)
            return [];
        const workspace = await Workspace.findById(list.workspace);
        if (!workspace)
            return [];
        const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
        if (!workspaceMember)
            return [];
        // Workspace owners and admins see all tasks
        if (workspaceMember.role === 'owner' || workspaceMember.role === 'admin') {
            return await Task.find({ list: listId, isDeleted: false });
        }
        // Check if user is space member
        const space = await Space.findById(list.space);
        if (space) {
            const spaceMember = space.members.find((m) => m.user.toString() === userId);
            if (spaceMember) {
                return await Task.find({ list: listId, isDeleted: false });
            }
        }
        // Check if user is list member
        const listMember = list.members?.find((m) => m.user.toString() === userId);
        if (listMember) {
            return await Task.find({ list: listId, isDeleted: false });
        }
        // Regular members only see tasks they're assigned to
        return await Task.find({
            list: listId,
            isDeleted: false,
            assignee: userId
        });
    }
    /**
     * Add member to space
     */
    async addSpaceMember(spaceId, userId, role = 'member') {
        const space = await Space.findById(spaceId);
        if (!space)
            throw new Error('Space not found');
        // Check if user is already a member
        const existingMember = space.members.find((m) => m.user.toString() === userId);
        if (existingMember) {
            // Update role if different
            existingMember.role = role;
        }
        else {
            // Add new member
            space.members.push({ user: userId, role });
        }
        await space.save();
        return space;
    }
    /**
     * Add member to list
     */
    async addListMember(listId, userId, role = 'member') {
        const list = await List.findById(listId);
        if (!list)
            throw new Error('List not found');
        // Initialize members array if it doesn't exist
        if (!list.members) {
            list.members = [];
        }
        // Check if user is already a member
        const existingMember = list.members.find((m) => m.user.toString() === userId);
        if (existingMember) {
            // Update role if different
            existingMember.role = role;
        }
        else {
            // Add new member
            list.members.push({ user: userId, role });
        }
        await list.save();
        return list;
    }
    /**
     * Remove member from space
     */
    async removeSpaceMember(spaceId, userId) {
        const space = await Space.findById(spaceId);
        if (!space)
            throw new Error('Space not found');
        space.members = space.members.filter((m) => m.user.toString() !== userId);
        await space.save();
        return space;
    }
    /**
     * Remove member from list
     */
    async removeListMember(listId, userId) {
        const list = await List.findById(listId);
        if (!list)
            throw new Error('List not found');
        if (list.members) {
            list.members = list.members.filter((m) => m.user.toString() !== userId);
            await list.save();
        }
        return list;
    }
}
module.exports = new AccessControlService();
