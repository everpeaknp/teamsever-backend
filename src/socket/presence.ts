import { Server } from "socket.io";
import { PresenceData } from "./types";

/**
 * In-memory presence tracking
 * Maps workspaceId to Set of online user IDs
 */
class PresenceManager {
  private workspacePresence: Map<string, Set<string>>;
  private userWorkspaces: Map<string, Set<string>>; // userId -> workspaceIds

  constructor() {
    this.workspacePresence = new Map();
    this.userWorkspaces = new Map();
  }

  /**
   * Add user to workspace presence
   */
  addUser(workspaceId: string, userId: string): void {
    // Add to workspace presence
    if (!this.workspacePresence.has(workspaceId)) {
      this.workspacePresence.set(workspaceId, new Set());
    }
    this.workspacePresence.get(workspaceId)!.add(userId);

    // Track user's workspaces
    if (!this.userWorkspaces.has(userId)) {
      this.userWorkspaces.set(userId, new Set());
    }
    this.userWorkspaces.get(userId)!.add(workspaceId);
  }

  /**
   * Remove user from workspace presence
   */
  removeUser(workspaceId: string, userId: string): void {
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
  removeUserFromAll(userId: string): string[] {
    const workspaces = this.userWorkspaces.get(userId);
    const affectedWorkspaces: string[] = [];

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
  getOnlineUsers(workspaceId: string): string[] {
    const users = this.workspacePresence.get(workspaceId);
    return users ? Array.from(users) : [];
  }

  /**
   * Get all workspaces user is in
   */
  getUserWorkspaces(userId: string): string[] {
    const workspaces = this.userWorkspaces.get(userId);
    return workspaces ? Array.from(workspaces) : [];
  }

  /**
   * Check if user is online in workspace
   */
  isUserOnline(workspaceId: string, userId: string): boolean {
    const workspace = this.workspacePresence.get(workspaceId);
    return workspace ? workspace.has(userId) : false;
  }

  /**
   * Emit presence update to workspace
   */
  emitPresenceUpdate(io: Server, workspaceId: string): void {
    const onlineUsers = this.getOnlineUsers(workspaceId);
    const presenceData: PresenceData = {
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
export {};
