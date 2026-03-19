"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socketService_1 = __importDefault(require("./socketService"));
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");
class PresenceService {
    constructor() {
        // In-memory cache of user last seen times
        this.lastSeenCache = new Map();
    }
    /**
     * Get user presence status
     */
    getUserPresence(userId) {
        const isOnline = socketService_1.default.isUserOnline(userId);
        const deviceCount = socketService_1.default.getUserConnectionCount(userId);
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
    updateLastSeen(userId) {
        this.lastSeenCache.set(userId, new Date());
    }
    /**
     * Get workspace presence (all members)
     */
    async getWorkspacePresence(workspaceId, requestingUserId) {
        // Verify workspace exists and user is a member
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false,
        }).lean();
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === requestingUserId);
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
        const memberIds = workspace.members.map((m) => m.user.toString());
        // Get presence for each member
        const onlineUsers = [];
        const offlineUsers = [];
        for (const userId of memberIds) {
            const presence = this.getUserPresence(userId);
            if (presence.status === "online") {
                onlineUsers.push(presence);
            }
            else {
                offlineUsers.push(presence);
            }
        }
        // Populate user details
        const users = await User.find({
            _id: { $in: memberIds },
        })
            .select("_id name email")
            .lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        // Add user details to presence
        const enrichPresence = (presence) => ({
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
    async broadcastUserOnline(userId, workspaceId) {
        try {
            // Get workspace members
            const workspace = await Workspace.findById(workspaceId)
                .select("members")
                .lean();
            if (!workspace)
                return;
            // Safety check: ensure members array exists
            if (!workspace.members || !Array.isArray(workspace.members)) {
                console.warn(`[Presence] Workspace ${workspaceId} has invalid members array in broadcastUserOnline`);
                return;
            }
            // Get user details
            const user = await User.findById(userId).select("name email").lean();
            if (!user)
                return;
            // Get all member IDs except the user who came online
            const memberIds = workspace.members
                .map((m) => m.user.toString())
                .filter((id) => id !== userId);
            // Emit to all workspace members
            memberIds.forEach((memberId) => {
                socketService_1.default.emitToUser(memberId, "user:online", {
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
        }
        catch (error) {
            console.error("[Presence] Failed to broadcast user:online:", error);
        }
    }
    /**
     * Broadcast user offline event to workspace members
     */
    async broadcastUserOffline(userId, workspaceId) {
        try {
            // Update last seen
            this.updateLastSeen(userId);
            // Get workspace members
            const workspace = await Workspace.findById(workspaceId)
                .select("members")
                .lean();
            if (!workspace)
                return;
            // Safety check: ensure members array exists
            if (!workspace.members || !Array.isArray(workspace.members)) {
                console.warn(`[Presence] Workspace ${workspaceId} has invalid members array in broadcastUserOffline`);
                return;
            }
            // Get user details
            const user = await User.findById(userId).select("name email").lean();
            if (!user)
                return;
            // Get all member IDs except the user who went offline
            const memberIds = workspace.members
                .map((m) => m.user.toString())
                .filter((id) => id !== userId);
            // Emit to all workspace members
            memberIds.forEach((memberId) => {
                socketService_1.default.emitToUser(memberId, "user:offline", {
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
        }
        catch (error) {
            console.error("[Presence] Failed to broadcast user:offline:", error);
        }
    }
    /**
     * Handle user connection (called when socket connects)
     */
    async handleUserConnect(userId, workspaceIds) {
        // Broadcast online status to all workspaces
        for (const workspaceId of workspaceIds) {
            await this.broadcastUserOnline(userId, workspaceId);
        }
    }
    /**
     * Handle user disconnection (called when last socket disconnects)
     */
    async handleUserDisconnect(userId, workspaceIds) {
        // Only broadcast offline if user has no more connections
        if (!socketService_1.default.isUserOnline(userId)) {
            for (const workspaceId of workspaceIds) {
                await this.broadcastUserOffline(userId, workspaceId);
            }
        }
    }
    /**
     * Get online users in workspace
     */
    async getOnlineUsersInWorkspace(workspaceId, requestingUserId) {
        const presence = await this.getWorkspacePresence(workspaceId, requestingUserId);
        return presence.onlineUsers;
    }
    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return socketService_1.default.isUserOnline(userId);
    }
    /**
     * Get user's last seen time
     */
    getLastSeen(userId) {
        return this.lastSeenCache.get(userId) || new Date();
    }
    /**
     * Clear last seen cache (for testing/cleanup)
     */
    clearCache() {
        this.lastSeenCache.clear();
    }
}
const presenceService = new PresenceService();
module.exports = presenceService;
exports.default = presenceService;
