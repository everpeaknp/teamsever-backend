import { Server } from "socket.io";
import { WorkspaceEventPayload, SpaceEventPayload, TaskEventPayload } from "./types";
import socketService from "../services/socketService";
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const ChatChannel = require("../models/ChatChannel");

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
 * Emit chat message event
 * Broadcasts to channel room
 */
const emitChatMessage = (
  channelId: string,
  message: any,
  workspaceId?: string
): void => {
  const socketIo = getIO();
  if (!socketIo) return;

  const resolveId = (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value._id) return value._id.toString();
    if (typeof value.toString === "function") return value.toString();
    return undefined;
  };

  const resolvedWorkspaceId = workspaceId || resolveId(message?.workspace);

  const fallbackEmit = () => {
    try {
      socketIo.to(`channel:${channelId}`).emit("chat:new", { message });
      if (resolvedWorkspaceId) {
        socketIo.to(`workspace:${resolvedWorkspaceId}`).emit("chat:new", { message });
      }
    } catch (error) {
      // Silent fail
    }
  };

  if (!resolvedWorkspaceId) {
    fallbackEmit();
    return;
  }

  (async () => {
    try {
      const [channel, workspace] = await Promise.all([
        ChatChannel.findById(channelId)
          .select("workspace type members createdBy name")
          .lean(),
        Workspace.findById(resolvedWorkspaceId)
          .select("members owner")
          .lean(),
      ]);

      if (!channel || !workspace) {
        fallbackEmit();
        return;
      }

      const workspaceMemberIds = (workspace.members || [])
        .map((member: any) => resolveId(member.user))
        .filter(Boolean) as string[];

      const ownerId = resolveId(workspace.owner);

      let candidateUserIds = new Set<string>(workspaceMemberIds);
      if (ownerId) {
        candidateUserIds.add(ownerId);
      }

      if (channel.type === "private") {
        const allowedIds = new Set<string>();
        (channel.members || []).forEach((memberId: any) => {
          const resolved = resolveId(memberId);
          if (resolved) allowedIds.add(resolved);
        });

        const createdById = resolveId(channel.createdBy);
        if (createdById) {
          allowedIds.add(createdById);
        }

        (workspace.members || []).forEach((member: any) => {
          if (member?.role === "admin" || member?.role === "owner") {
            const resolved = resolveId(member.user);
            if (resolved) allowedIds.add(resolved);
          }
        });

        if (ownerId) {
          allowedIds.add(ownerId);
        }

        candidateUserIds = allowedIds;
      }

      const userIds = Array.from(candidateUserIds);
      if (userIds.length === 0) {
        return;
      }

      const users = await User.find({ _id: { $in: userIds } })
        .select("_id notificationPreferences")
        .lean();

      const allowedUserIds = users
        .filter((user: any) => {
          const prefs = user?.notificationPreferences;
          if (!prefs) return true;

          if (prefs.groupChats === false) return false;

          const mutedChannels = Array.isArray(prefs.mutedChannels) ? prefs.mutedChannels : [];
          if (mutedChannels.includes(channelId)) return false;
          if (mutedChannels.includes(`workspace_${resolvedWorkspaceId}`)) return false;

          return true;
        })
        .map((user: any) => user._id.toString());

      if (allowedUserIds.length === 0) {
        return;
      }

      socketService.emitToUsers(allowedUserIds, "chat:new", { message });
    } catch (error) {
      fallbackEmit();
    }
  })();
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
  emitChatMessage,
  emitToUser,
  getWorkspaceOnlineCount
};
export {};
