"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Socket service statistics interface
 */
class SocketService {
    constructor() {
        // userId -> Set of socketIds
        this.userSockets = new Map();
        // socketId -> userId (reverse lookup)
        this.socketUsers = new Map();
        // Socket.IO server instance
        this.io = null;
    }
    /**
     * Initialize with Socket.IO server instance
     */
    initialize(socketIo) {
        this.io = socketIo;
        console.log("[SocketService] Initialized");
    }
    /**
     * Get Socket.IO instance
     */
    getIO() {
        if (!this.io) {
            throw new Error("Socket.IO not initialized. Call initialize() first.");
        }
        return this.io;
    }
    /**
     * Add socket connection for a user
     */
    addSocket(userId, socketId) {
        // Add to user's socket set
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socketId);
        // Add reverse lookup
        this.socketUsers.set(socketId, userId);
        const socketCount = this.userSockets.get(userId).size;
        console.log(`[SocketService] Added socket ${socketId} for user ${userId} (total: ${socketCount})`);
    }
    /**
     * Remove socket connection for a user
     */
    removeSocket(userId, socketId) {
        // Remove from user's socket set
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socketId);
            // Clean up if no more sockets
            if (userSocketSet.size === 0) {
                this.userSockets.delete(userId);
                console.log(`[SocketService] User ${userId} is now offline (no active sockets)`);
            }
            else {
                console.log(`[SocketService] Removed socket ${socketId} for user ${userId} (remaining: ${userSocketSet.size})`);
            }
        }
        // Remove reverse lookup
        this.socketUsers.delete(socketId);
    }
    /**
     * Remove socket by socketId only (useful for disconnect events)
     */
    removeSocketById(socketId) {
        const userId = this.socketUsers.get(socketId);
        if (userId) {
            this.removeSocket(userId, socketId);
            return userId;
        }
        return null;
    }
    /**
     * Get all socket IDs for a user
     */
    getUserSockets(userId) {
        const sockets = this.userSockets.get(userId);
        return sockets ? Array.from(sockets) : [];
    }
    /**
     * Check if user has any active connections
     */
    isUserOnline(userId) {
        const sockets = this.userSockets.get(userId);
        return sockets ? sockets.size > 0 : false;
    }
    /**
     * Get number of active connections for a user
     */
    getUserConnectionCount(userId) {
        const sockets = this.userSockets.get(userId);
        return sockets ? sockets.size : 0;
    }
    /**
     * Get all online user IDs
     */
    getOnlineUsers() {
        return Array.from(this.userSockets.keys());
    }
    /**
     * Get total number of online users
     */
    getOnlineUserCount() {
        return this.userSockets.size;
    }
    /**
     * Get total number of socket connections
     */
    getTotalConnectionCount() {
        let total = 0;
        this.userSockets.forEach((sockets) => {
            total += sockets.size;
        });
        return total;
    }
    /**
     * Emit event to all devices of a specific user
     */
    emitToUser(userId, event, data) {
        try {
            const socketIds = this.getUserSockets(userId);
            if (socketIds.length === 0) {
                console.log(`[SocketService] User ${userId} has no active connections`);
                return false;
            }
            const io = this.getIO();
            let successCount = 0;
            socketIds.forEach((socketId) => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit(event, data);
                    successCount++;
                }
            });
            console.log(`[SocketService] Emitted '${event}' to ${successCount}/${socketIds.length} devices for user ${userId}`);
            return successCount > 0;
        }
        catch (error) {
            console.error(`[SocketService] Failed to emit to user ${userId}:`, error);
            return false;
        }
    }
    /**
     * Emit event to multiple users
     */
    emitToUsers(userIds, event, data) {
        userIds.forEach((userId) => {
            this.emitToUser(userId, event, data);
        });
    }
    /**
     * Broadcast event to all connected users
     */
    broadcastToAll(event, data) {
        try {
            const io = this.getIO();
            io.emit(event, data);
            console.log(`[SocketService] Broadcasted '${event}' to all users`);
        }
        catch (error) {
            console.error("[SocketService] Failed to broadcast:", error);
        }
    }
    /**
     * Get user ID from socket ID
     */
    getUserIdBySocketId(socketId) {
        return this.socketUsers.get(socketId);
    }
    /**
     * Get socket instance by socket ID
     */
    getSocketById(socketId) {
        try {
            const io = this.getIO();
            return io.sockets.sockets.get(socketId);
        }
        catch (error) {
            return undefined;
        }
    }
    /**
     * Get all socket instances for a user
     */
    getUserSocketInstances(userId) {
        try {
            const io = this.getIO();
            const socketIds = this.getUserSockets(userId);
            const sockets = [];
            socketIds.forEach((socketId) => {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    sockets.push(socket);
                }
            });
            return sockets;
        }
        catch (error) {
            console.error(`[SocketService] Failed to get socket instances for user ${userId}:`, error);
            return [];
        }
    }
    /**
     * Disconnect all sockets for a user
     */
    disconnectUser(userId, reason) {
        try {
            const sockets = this.getUserSocketInstances(userId);
            sockets.forEach((socket) => {
                socket.disconnect(true);
            });
            console.log(`[SocketService] Disconnected ${sockets.length} sockets for user ${userId}`);
        }
        catch (error) {
            console.error(`[SocketService] Failed to disconnect user ${userId}:`, error);
        }
    }
    /**
     * Get service statistics
     */
    getStats() {
        const stats = {
            onlineUsers: this.getOnlineUserCount(),
            totalConnections: this.getTotalConnectionCount(),
            averageConnectionsPerUser: this.getOnlineUserCount() > 0
                ? (this.getTotalConnectionCount() / this.getOnlineUserCount()).toFixed(2)
                : "0",
            users: Array.from(this.userSockets.entries()).map(([userId, sockets]) => ({
                userId,
                connectionCount: sockets.size,
                socketIds: Array.from(sockets)
            }))
        };
        return stats;
    }
    /**
     * Clear all connections (useful for testing/reset)
     */
    clear() {
        this.userSockets.clear();
        this.socketUsers.clear();
        console.log("[SocketService] Cleared all connections");
    }
}
// Singleton instance
const socketService = new SocketService();
module.exports = socketService;
exports.default = socketService;
