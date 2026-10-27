const socketService = require("../services/socketService");

const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const chatService = require("../services/chatService");
const presenceService = require("../services/presenceService");
const presenceManager = require("./presence");
const { checkMessageLimitForWorkspace } = require("../middlewares/messageLimitMiddleware");

/**
 * Register all socket event handlers
 */
const registerHandlers = (io, socket) => {
  const userId = socket.user!.id;

  // Register socket connection with socket service
  socketService.addSocket(userId, socket.id);

  // Join user's personal room for direct notifications
  socket.join(`user:${userId}`);

  // Emit user:online event to relevant users
  try {
    // Get user's workspaces to notify workspace members
    const Workspace = require("../models/Workspace");
    Workspace.find({
      "members.user": userId,
      isDeleted: false,
    })
      .select("_id members")
      .lean()
      .then((workspaces) => {
        workspaces.forEach((workspace) => {
          // Safety check: ensure members array exists
          if (!workspace.members || !Array.isArray(workspace.members)) {
            console.warn(`[Socket] Workspace ${workspace._id} has invalid members array`);
            return;
          }
          
          // Notify all workspace members that user is online
          workspace.members.forEach((member) => {
            const memberId = member.user.toString();
            if (memberId !== userId) {
              socketService.emitToUser(memberId, "user:online", {
                userId,
                userName: socket.user!.name,
                workspaceId: workspace._id.toString(),
                timestamp: new Date(),
              });
            }
          });
        });
      })
      .catch((error) => {
        console.error("[Socket] Failed to emit user:online event:", error);
      });
  } catch (error) {
    console.error("[Socket] Failed to emit user:online event:", error);
  }

  /**
   * Join workspace room
   */
  socket.on("join_workspace", async (payload) => {
    try {
      const { workspaceId } = payload;

      if (!workspaceId) {
        socket.emit("error", { message: "Workspace ID is required" });
        return;
      }

      // Verify user is workspace member
      const { membership } = await chatService.validateWorkspaceMembership(workspaceId, userId);

      // Join workspace room
      const roomName = `workspace:${workspaceId}`;
      await socket.join(roomName);

      // Add to presence
      presenceManager.addUser(workspaceId, userId);
      presenceManager.emitPresenceUpdate(io, workspaceId);

      socket.emit("joined_workspace", { workspaceId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: error.message || "Failed to join workspace" });
    }
  });

  /**
   * Join channel room
   */
  socket.on("join_channel", async (payload) => {
    try {
      const { channelId } = payload;

      if (!channelId) {
        socket.emit("error", { message: "Channel ID is required" });
        return;
      }

      // Verify channel access (via chatService)
      const channel = await chatService.validateChannelAccess(channelId, userId);

      // Join channel room
      const roomName = `channel:${channelId}`;
      await socket.join(roomName);

      socket.emit("joined_channel", { channelId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: error.message || "Failed to join channel" });
    }
  });

  /**
   * Leave channel room
   */
  socket.on("leave_channel", async (payload) => {
    try {
      const { channelId } = payload;
      if (channelId) {
        await socket.leave(`channel:${channelId}`);
        socket.emit("left_channel", { channelId });
      }
    } catch (error) {
      // Ignored
    }
  });

  /**
   * Join space room
   */
  socket.on("join_space", async (payload) => {
    try {
      const { spaceId } = payload;

      if (!spaceId) {
        socket.emit("error", { message: "Space ID is required" });
        return;
      }

      // Verify space exists and user has access
      const space = await Space.findOne({
        _id: spaceId,
        isDeleted: false
      }).lean();

      if (!space) {
        socket.emit("error", { message: "Space not found" });
        return;
      }

      // Verify user is workspace member
      await chatService.validateWorkspaceMembership(space.workspace.toString(), userId);

      // Join space room
      const roomName = `space:${spaceId}`;
      await socket.join(roomName);

      socket.emit("joined_space", { spaceId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: error.message || "Failed to join space" });
    }
  });

  /**
   * Join task room
   */
  socket.on("join_task", async (payload) => {
    try {
      const { taskId } = payload;

      if (!taskId) {
        socket.emit("error", { message: "Task ID is required" });
        return;
      }

      // Verify task exists and user has access
      const Task = require("../models/Task");
      const task = await Task.findOne({
        _id: taskId,
        isDeleted: false
      }).lean();

      if (!task) {
        socket.emit("error", { message: "Task not found" });
        return;
      }

      // Verify user is workspace member
      await chatService.validateWorkspaceMembership(task.workspace.toString(), userId);

      // Join task room
      const roomName = `task:${taskId}`;
      await socket.join(roomName);

      socket.emit("joined_task", { taskId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: error.message || "Failed to join task" });
    }
  });

  /**
   * Leave task room
   */
  socket.on("leave_task", async (payload) => {
    try {
      const { taskId } = payload;

      if (!taskId) {
        socket.emit("error", { message: "Task ID is required" });
        return;
      }

      const roomName = `task:${taskId}`;
      await socket.leave(roomName);

      socket.emit("left_task", { taskId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: "Failed to leave task" });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on("disconnect", () => {
    // Remove socket from socket service
    socketService.removeSocket(userId, socket.id);

    // Presence is per user, so one disconnected device must not mark a user
    // offline while another socket is still connected.
    if (socketService.isUserOnline(userId)) return;

    const affectedWorkspaces = presenceManager.removeUserFromAll(userId);
    affectedWorkspaces.forEach((workspaceId) => {
      presenceManager.emitPresenceUpdate(io, workspaceId);
    });

    // Persists lastSeenAt and emits the canonical user:offline event. The
    // service checks the connection state again to avoid a reconnect race.
    void presenceService.handleUserDisconnect(userId, affectedWorkspaces).catch((error) => {
      console.error("[Socket] Failed to update user offline presence:", error);
    });
  });

  /**
   * Chat: Send message
   */
  socket.on("chat:send", async (payload) => {
    try {
      const { workspaceId, channelId, content, mentions, replyToMessageId, attachments } = payload;

      if (!workspaceId) {
        socket.emit("error", { message: "Workspace ID is required" });
        return;
      }

      // Check message limit
      const limitCheck = await checkMessageLimitForWorkspace(workspaceId);
      if (!limitCheck.allowed) {
        socket.emit("error", limitCheck.error);
        return;
      }

      // Create message (validates membership and channel access)
      const message = await chatService.createMessage({
        workspaceId,
        channelId,
        senderId: userId,
        content,
        mentions: mentions || [],
        replyToMessageId,
        ...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
      });

      // `chatService.createMessage` already emits `chat:new` to channel/workspace rooms.
      // Avoid duplicate broadcasts from socket handler.
    } catch (error) {
      socket.emit("error", { 
        message: error.message || "Failed to send message" 
      });
    }
  });

  /**
   * Chat: Typing indicator
   */
  const emitTyping = async (payload, isTyping) => {
    try {
      const { channelId, conversationId } = payload || {};
      const event = isTyping ? "chat:user_typing" : "chat:user_stop_typing";
      const data = { channelId, conversationId, userId, userName: socket.user!.name };
      if (channelId) {
        await chatService.validateChannelAccess(channelId, userId);
        socket.to(`channel:${channelId}`).emit(event, data);
        return;
      }
      if (!conversationId) return;
      const Conversation = require("../models/Conversation");
      const conversation = await Conversation.findById(conversationId).select("participants").lean();
      if (!conversation || !conversation.participants.some((participant) => participant.toString() === userId)) return;
      const recipientIds = conversation.participants
        .map((participant) => participant.toString())
        .filter((participantId) => participantId !== userId);
      socketService.emitToUsers(recipientIds, event, data);
    } catch (error) {
      // Typing is transient; invalid or expired chat targets are ignored.
    }
  };

  socket.on("chat:typing", (payload) => emitTyping(payload, true));

  /**
   * Chat: Stop typing indicator
   */
  socket.on("chat:stop_typing", (payload) => emitTyping(payload, false));
};

module.exports = registerHandlers;

export {};
