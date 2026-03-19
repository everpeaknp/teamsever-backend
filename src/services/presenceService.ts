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
  lastSeen: Date;
  deviceCount: number;
}

interface WorkspacePresence {
  workspaceId: string;
  onlineUsers: UserPresence[];
  offlineUsers: UserPresence[];
  totalMembers: number;
}

class PresenceService {
  // In-memory cache of user last seen times
  private lastSeenCache: Map<string, Date> = new Map();

  /**
   * Get user presence status
   */
  getUserPresence(userId: string): UserPresence {
    const isOnline = socketService.isUserOnline(userId);
    const deviceCount = socketService.getUserConnectionCount(userId);
    const lastSeen = this.lastSeenCache.get(userId) || new Date();

    return {
      userId,
      status: isOnline ? "online" : "offline",
      lastSeen: isOnline ? new Date() : lastSeen,
      deviceCount,
    };
  }

  /**
   * Update user last seen time
   */
  updateLastSeen(userId: string): void {
    this.lastSeenCache.set(userId, new Date());
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

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === requestingUserId
    );

    if (!isMember) {
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

    // Get presence for each member
    const onlineUsers: UserPresence[] = [];
    const offlineUsers: UserPresence[] = [];

    for (const userId of memberIds) {
      const presence = this.getUserPresence(userId);
      
      if (presence.status === "online") {
        onlineUsers.push(presence);
      } else {
        offlineUsers.push(presence);
      }
    }

    // Populate user details
    const users = await User.find({
      _id: { $in: memberIds },
    })
      .select("_id name email")
      .lean();

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

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

      console.log(`[Presence] Broadcasted user:online for ${userId} in workspace ${workspaceId}`);
    } catch (error) {
      console.error("[Presence] Failed to broadcast user:online:", error);
    }
  }

  /**
   * Broadcast user offline event to workspace members
   */
  async broadcastUserOffline(userId: string, workspaceId: string): Promise<void> {
    try {
      // Update last seen
      this.updateLastSeen(userId);

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
          lastSeen: this.lastSeenCache.get(userId) || new Date(),
          timestamp: new Date(),
        });
      });

      console.log(`[Presence] Broadcasted user:offline for ${userId} in workspace ${workspaceId}`);
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
      for (const workspaceId of workspaceIds) {
        await this.broadcastUserOffline(userId, workspaceId);
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

  /**
   * Get user's last seen time
   */
  getLastSeen(userId: string): Date {
    return this.lastSeenCache.get(userId) || new Date();
  }

  /**
   * Clear last seen cache (for testing/cleanup)
   */
  clearCache(): void {
    this.lastSeenCache.clear();
  }
}

const presenceService = new PresenceService();

module.exports = presenceService;
export default presenceService;
