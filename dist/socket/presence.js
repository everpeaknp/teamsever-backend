"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * In-memory presence tracking
 * Maps workspaceId to Set of online user IDs
 */
class PresenceManager {
    constructor() {
        this.workspacePresence = new Map();
        this.userWorkspaces = new Map();
    }
    /**
     * Add user to workspace presence
     */
    addUser(workspaceId, userId) {
        // Add to workspace presence
        if (!this.workspacePresence.has(workspaceId)) {
            this.workspacePresence.set(workspaceId, new Set());
        }
        this.workspacePresence.get(workspaceId).add(userId);
        // Track user's workspaces
        if (!this.userWorkspaces.has(userId)) {
            this.userWorkspaces.set(userId, new Set());
        }
        this.userWorkspaces.get(userId).add(workspaceId);
    }
    /**
     * Remove user from workspace presence
     */
    removeUser(workspaceId, userId) {
        const workspace = this.workspacePresence.get(workspaceId);
        if (workspace) {
            workspace.delete(userId);
            if (workspace.size === 0) {
                this.workspacePresence.delete(workspaceId);
            }
        }
        const userWs = this.userWorkspaces.get(userId);
        if (userWs) {
            userWs.delete(workspaceId);
            if (userWs.size === 0) {
                this.userWorkspaces.delete(userId);
            }
        }
    }
    /**
     * Remove user from all workspaces (on disconnect)
     */
    removeUserFromAll(userId) {
        const workspaces = this.userWorkspaces.get(userId);
        const affectedWorkspaces = [];
        if (workspaces) {
            workspaces.forEach((workspaceId) => {
                this.removeUser(workspaceId, userId);
                affectedWorkspaces.push(workspaceId);
            });
        }
        return affectedWorkspaces;
    }
    /**
     * Get online users in workspace
     */
    getOnlineUsers(workspaceId) {
        const users = this.workspacePresence.get(workspaceId);
        return users ? Array.from(users) : [];
    }
    /**
     * Get all workspaces user is in
     */
    getUserWorkspaces(userId) {
        const workspaces = this.userWorkspaces.get(userId);
        return workspaces ? Array.from(workspaces) : [];
    }
    /**
     * Check if user is online in workspace
     */
    isUserOnline(workspaceId, userId) {
        const workspace = this.workspacePresence.get(workspaceId);
        return workspace ? workspace.has(userId) : false;
    }
    /**
     * Emit presence update to workspace
     */
    emitPresenceUpdate(io, workspaceId) {
        const onlineUsers = this.getOnlineUsers(workspaceId);
        const presenceData = {
            workspaceId,
            onlineUsers
        };
        io.to(`workspace:${workspaceId}`).emit("presence:update", presenceData);
    }
    /**
     * Get stats for debugging
     */
    getStats() {
        return {
            totalWorkspaces: this.workspacePresence.size,
            totalUsers: this.userWorkspaces.size,
            workspaces: Array.from(this.workspacePresence.entries()).map(([id, users]) => ({
                workspaceId: id,
                userCount: users.size
            }))
        };
    }
}
// Singleton instance
const presenceManager = new PresenceManager();
module.exports = presenceManager;
