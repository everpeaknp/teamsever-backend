import socketService from "./socketService";

const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");

/**
 * Presence Service
 * Manages user online/offline status and broadcasts presence updates
 */

interface UserPresence {
  userId: string;
  status: "online" | "offline";
  lastSeen: Date | null;
  deviceCount: number;
}

interface WorkspacePresence {
  workspaceId: string;
  onlineUsers: UserPresence[];
  offlineUsers: UserPresence[];
  totalMembers: number;
}

class PresenceService {
  /**
   * Get user presence status
   */
  async getUserPresence(userId: string): Promise<UserPresence> {
    const isOnline = socketService.isUserOnline(userId);
    const deviceCount = socketService.getUserConnectionCount(userId);
    const user = await User.findById(userId).select("lastSeenAt").lean();

    return {
      userId,
      status: isOnline ? "online" : "offline",
      lastSeen: isOnline ? new Date() : user?.lastSeenAt ?? null,
      deviceCount,
    };
  }

  /**
   * Update user last seen time
   */
  async updateLastSeen(userId: string, lastSeenAt = new Date()): Promise<Date> {
    await User.updateOne({ _id: userId }, { $set: { lastSeenAt } });
    return lastSeenAt;
  }

  /**
   * Get workspace presence (all members)
   */
  async getWorkspacePresence(
    workspaceId: string,
    requestingUserId: string
  ): Promise<WorkspacePresence> {
    // Verify workspace exists and user is a member
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isOwner = workspace.owner.toString() === requestingUserId;
    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === requestingUserId
    );

    if (!isOwner && !isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Safety check: ensure members array exists
    if (!workspace.members || !Array.isArray(workspace.members)) {
      console.warn(`[Presence] Workspace ${workspaceId} has invalid members array`);
      return {
        workspaceId,
        onlineUsers: [],
        offlineUsers: [],
        totalMembers: 0,
      };
    }

    // Get all member user IDs
    const memberIds = workspace.members.map((m: any) => m.user.toString());

    // Load names and persisted last-seen values in one query.
    const users = await User.find({ _id: { $in: memberIds } })
      .select("_id name email lastSeenAt")
      .lean();
    const userMap = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));

    // Get presence for each member
    const onlineUsers: UserPresence[] = [];
    const offlineUsers: UserPresence[] = [];

    for (const userId of memberIds) {
      const isOnline = socketService.isUserOnline(userId);
      const user = userMap.get(userId);
      const presence: UserPresence = {
        userId,
        status: isOnline ? "online" : "offline",
        lastSeen: isOnline ? new Date() : user?.lastSeenAt ?? null,
        deviceCount: socketService.getUserConnectionCount(userId),
      };
      
      if (presence.status === "online") {
        onlineUsers.push(presence);
      } else {
        offlineUsers.push(presence);
      }
    }

    // Add user details to presence
    const enrichPresence = (presence: UserPresence) => ({
      ...presence,
      user: userMap.get(presence.userId),
    });

    return {
      workspaceId,
      onlineUsers: onlineUsers.map(enrichPresence),
      offlineUsers: offlineUsers.map(enrichPresence),
      totalMembers: memberIds.length,
    };
  }

  /**
   * Broadcast user online event to workspace members
   */
  async broadcastUserOnline(userId: string, workspaceId: string): Promise<void> {
    try {
      // Get workspace members
      const workspace = await Workspace.findById(workspaceId)
        .select("members")
        .lean();

      if (!workspace) return;
      
      // Safety check: ensure members array exists
      if (!workspace.members || !Array.isArray(workspace.members)) {
        console.warn(`[Presence] Workspace ${workspaceId} has invalid members array in broadcastUserOnline`);
        return;
      }

      // Get user details
      const user = await User.findById(userId).select("name email").lean();
      if (!user) return;

      // Get all member IDs except the user who came online
      const memberIds = workspace.members
        .map((m: any) => m.user.toString())
        .filter((id: string) => id !== userId);

      // Emit to all workspace members
      memberIds.forEach((memberId: string) => {
        socketService.emitToUser(memberId, "user:online", {
          workspaceId,
          user: {
            _id: userId,
            name: user.name,
            email: user.email,
          },
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("[Presence] Failed to broadcast user:online:", error);
    }
  }

  /**
   * Broadcast user offline event to workspace members
   */
  async broadcastUserOffline(userId: string, workspaceId: string, recordedLastSeen?: Date): Promise<void> {
    try {
      // Standalone callers persist here; a disconnect handler can pass the
      // single timestamp it already recorded for all workspace broadcasts.
      const lastSeen = recordedLastSeen ?? new Date();
      if (!recordedLastSeen) {
        try {
          await this.updateLastSeen(userId, lastSeen);
        } catch (error) {
          console.error("[Presence] Failed to persist last-seen time:", error);
        }
      }

      // Get workspace members
      const workspace = await Workspace.findById(workspaceId)
        .select("members")
        .lean();

      if (!workspace) return;
      
      // Safety check: ensure members array exists
      if (!workspace.members || !Array.isArray(workspace.members)) {
        console.warn(`[Presence] Workspace ${workspaceId} has invalid members array in broadcastUserOffline`);
        return;
      }

      // Get user details
      const user = await User.findById(userId).select("name email").lean();
      if (!user) return;

      // Get all member IDs except the user who went offline
      const memberIds = workspace.members
        .map((m: any) => m.user.toString())
        .filter((id: string) => id !== userId);

      // Emit to all workspace members
      memberIds.forEach((memberId: string) => {
        socketService.emitToUser(memberId, "user:offline", {
          workspaceId,
          user: {
            _id: userId,
            name: user.name,
            email: user.email,
          },
          lastSeen,
          timestamp: new Date(),
        });
      });
    } catch (error) {
      console.error("[Presence] Failed to broadcast user:offline:", error);
    }
  }

  /**
   * Handle user connection (called when socket connects)
   */
  async handleUserConnect(userId: string, workspaceIds: string[]): Promise<void> {
    // Broadcast online status to all workspaces
    for (const workspaceId of workspaceIds) {
      await this.broadcastUserOnline(userId, workspaceId);
    }
  }

  /**
   * Handle user disconnection (called when last socket disconnects)
   */
  async handleUserDisconnect(userId: string, workspaceIds: string[]): Promise<void> {
    // Only broadcast offline if user has no more connections
    if (!socketService.isUserOnline(userId)) {
      const lastSeen = new Date();
      try {
        // Persist even when this socket had not joined a workspace room.
        await this.updateLastSeen(userId, lastSeen);
      } catch (error) {
        console.error("[Presence] Failed to persist last-seen time:", error);
      }
      for (const workspaceId of workspaceIds) {
        await this.broadcastUserOffline(userId, workspaceId, lastSeen);
      }
    }
  }

  /**
   * Get online users in workspace
   */
  async getOnlineUsersInWorkspace(
    workspaceId: string,
    requestingUserId: string
  ): Promise<any[]> {
    const presence = await this.getWorkspacePresence(workspaceId, requestingUserId);
    return presence.onlineUsers;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return socketService.isUserOnline(userId);
  }

}

const presenceService = new PresenceService();

module.exports = presenceService;
export default presenceService;
