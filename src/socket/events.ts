import { Server } from "socket.io";
import { WorkspaceEventPayload, SpaceEventPayload, TaskEventPayload } from "./types";
import socketService from "../services/socketService";

let io: Server | null = null;

/**
 * Initialize socket.io instance
 */
const initializeSocket = (socketIo: Server): void => {
  io = socketIo;
  // Initialize socket service with the same instance
  socketService.initialize(socketIo);
};

/**
 * Get socket.io instance
 */
const getIO = (): Server | null => {
  return io;
};

/**
 * Check if socket.io is initialized
 */
const isSocketInitialized = (): boolean => {
  return io !== null;
};

/**
 * Emit workspace event
 * Broadcasts to all users in workspace room
 */
const emitWorkspaceEvent = (
  workspaceId: string,
  type: WorkspaceEventPayload["type"],
  data: any,
  userId: string
): void => {
  const socketIo = getIO();
  if (!socketIo) return; // Silent fail if socket not initialized
  
  try {
    const payload: WorkspaceEventPayload = {
      type,
      data,
      userId
    };

    socketIo.to(`workspace:${workspaceId}`).emit("workspace:event", payload);
  } catch (error) {
    // Silent fail - non-critical
  }
};

/**
 * Emit space event
 * Broadcasts to all users in space room
 */
const emitSpaceEvent = (
  spaceId: string,
  type: SpaceEventPayload["type"],
  data: any,
  userId: string
): void => {
  const socketIo = getIO();
  if (!socketIo) return; // Silent fail if socket not initialized
  
  try {
    const payload: SpaceEventPayload = {
      type,
      data,
      userId
    };

    socketIo.to(`space:${spaceId}`).emit("space:event", payload);
  } catch (error) {
    // Silent fail - non-critical
  }
};

/**
 * Emit task event
 * Broadcasts to all users in task room
 */
const emitTaskEvent = (
  taskId: string,
  type: TaskEventPayload["type"],
  data: any,
  userId: string
): void => {
  const socketIo = getIO();
  if (!socketIo) return; // Silent fail if socket not initialized
  
  try {
    const payload: TaskEventPayload = {
      type,
      data,
      userId
    };

    socketIo.to(`task:${taskId}`).emit("task:event", payload);
  } catch (error) {
    // Silent fail - non-critical
  }
};

/**
 * Emit to specific user by user ID
 * Uses socketService for efficient multi-device delivery
 */
const emitToUser = (userId: string, event: string, data: any): void => {
  socketService.emitToUser(userId, event, data);
};

/**
 * Get online users count in workspace
 */
const getWorkspaceOnlineCount = (workspaceId: string): number => {
  const socketIo = getIO();
  if (!socketIo) return 0; // Return 0 if socket not initialized
  
  try {
    const room = socketIo.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
    return room ? room.size : 0;
  } catch (error) {
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
export {};
