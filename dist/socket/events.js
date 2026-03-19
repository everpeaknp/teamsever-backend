"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socketService_1 = __importDefault(require("../services/socketService"));
let io = null;
/**
 * Initialize socket.io instance
 */
const initializeSocket = (socketIo) => {
    io = socketIo;
    // Initialize socket service with the same instance
    socketService_1.default.initialize(socketIo);
};
/**
 * Get socket.io instance
 */
const getIO = () => {
    return io;
};
/**
 * Check if socket.io is initialized
 */
const isSocketInitialized = () => {
    return io !== null;
};
/**
 * Emit workspace event
 * Broadcasts to all users in workspace room
 */
const emitWorkspaceEvent = (workspaceId, type, data, userId) => {
    const socketIo = getIO();
    if (!socketIo)
        return; // Silent fail if socket not initialized
    try {
        const payload = {
            type,
            data,
            userId
        };
        socketIo.to(`workspace:${workspaceId}`).emit("workspace:event", payload);
    }
    catch (error) {
        // Silent fail - non-critical
    }
};
/**
 * Emit space event
 * Broadcasts to all users in space room
 */
const emitSpaceEvent = (spaceId, type, data, userId) => {
    const socketIo = getIO();
    if (!socketIo)
        return; // Silent fail if socket not initialized
    try {
        const payload = {
            type,
            data,
            userId
        };
        socketIo.to(`space:${spaceId}`).emit("space:event", payload);
    }
    catch (error) {
        // Silent fail - non-critical
    }
};
/**
 * Emit task event
 * Broadcasts to all users in task room
 */
const emitTaskEvent = (taskId, type, data, userId) => {
    const socketIo = getIO();
    if (!socketIo)
        return; // Silent fail if socket not initialized
    try {
        const payload = {
            type,
            data,
            userId
        };
        socketIo.to(`task:${taskId}`).emit("task:event", payload);
    }
    catch (error) {
        // Silent fail - non-critical
    }
};
/**
 * Emit to specific user by user ID
 * Uses socketService for efficient multi-device delivery
 */
const emitToUser = (userId, event, data) => {
    socketService_1.default.emitToUser(userId, event, data);
};
/**
 * Get online users count in workspace
 */
const getWorkspaceOnlineCount = (workspaceId) => {
    const socketIo = getIO();
    if (!socketIo)
        return 0; // Return 0 if socket not initialized
    try {
        const room = socketIo.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
        return room ? room.size : 0;
    }
    catch (error) {
        console.error("Failed to get online count:", error);
        return 0;
    }
};
module.exports = {
    initializeSocket,
    getIO,
    isSocketInitialized,
    emitWorkspaceEvent,
    emitSpaceEvent,
    emitTaskEvent,
    emitToUser,
    getWorkspaceOnlineCount
};
