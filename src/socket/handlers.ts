const socketService = require("../services/socketService");

const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const chatService = require("../services/chatService");
const presenceManager = require("./presence");
const { checkMessageLimitForWorkspace } = require("../middlewares/messageLimitMiddleware");

/**
 * Register all socket event handlers
 */
const registerHandlers = (io, socket) => {
  const userId = socket.user!.id;
  const userName = socket.user!.name;

  // Register socket connection with socket service
  socketService.addSocket(userId, socket.id);

  // User Room Broadcasting
  // Ensure all sessions of the same user join the same room
  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  // Automatic Room Joining on Connect
  // We'll join workspace, DM, and group rooms immediately
  const initializeUserRooms = async () => {
    try {
      // 1. Join all workspace rooms user is a member of
      const workspaces = await Workspace.find({
        "members.user": userId,
        isDeleted: false,
      }).select("_id").lean();

      workspaces.forEach(ws => {
        const room = `workspace:${ws._id}`;
        socket.join(room);
        presenceManager.addUser(ws._id.toString(), userId);
        presenceManager.emitPresenceUpdate(io, ws._id.toString());
        
        // Group Member Join Event
        socket.to(room).emit("group:memberJoined", { userId, userName, timestamp: new Date() });
      });

      // 2. Join DM rooms
      const Conversation = require("../models/Conversation");
      const conversations = await Conversation.find({
        participants: userId,
        isDeleted: false
      }).select("_id").lean();

      conversations.forEach(conv => {
        socket.join(`dm:${conv._id}`);
      });

      // Inbox Update for unread counts
      socket.emit("inbox:update", { unreadTotal: 0 }); // Trigger initial sync

      // Online Presence
      workspaces.forEach(workspace => {
        socket.to(`workspace:${workspace._id}`).emit("user:online", {
          userId,
          userName,
          timestamp: new Date()
        });
      });

    } catch (error) {
      console.error("[Socket] Failed to initialize user rooms:", error);
    }
  };

  initializeUserRooms();

  /**
   * Join workspace room
   */
  socket.on("join_workspace", async (payload) => {
    try {
      const { workspaceId } = payload;
      if (!workspaceId) return;

      await chatService.validateWorkspaceMembership(workspaceId, userId);
      const roomName = `workspace:${workspaceId}`;
      await socket.join(roomName);

      presenceManager.addUser(workspaceId, userId);
      presenceManager.emitPresenceUpdate(io, workspaceId);

      socket.emit("joined_workspace", { workspaceId, room: roomName });
    } catch (error) {
      socket.emit("error", { message: error.message || "Failed to join workspace" });
    }
  });

  /**
   * DM Rooms
   */
  socket.on("join_dm", async (payload) => {
    try {
      const { conversationId } = payload;
      if (!conversationId) return;

      // Validate access to conversation
      const Conversation = require("../models/Conversation");
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId
      }).lean();

      if (!conversation) throw new Error("Conversation not found or access denied");

      await socket.join(`dm:${conversationId}`);
      socket.emit("joined_dm", { conversationId });
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  /**
   * Sending Messages (Emitter Side)
   */
  socket.on("chat:send", async (payload, callback) => {
    try {
      const { workspaceId, channelId, content, mentions, tempId } = payload;

      if (!workspaceId) throw new Error("Workspace ID is required");

      const limitCheck = await checkMessageLimitForWorkspace(workspaceId);
      if (!limitCheck.allowed) {
        if (callback) callback({ status: "error", message: limitCheck.error });
        return;
      }

      const message = await chatService.createMessage({
        workspaceId,
        channelId,
        senderId: userId,
        content,
        mentions: mentions || [],
      });

      const messageData = {
        _id: message._id,
        tempId: tempId, // Send back tempId for optimistic UI sync
        workspace: message.workspace,
        channel: channelId,
        sender: message.sender,
        content: message.content,
        type: message.type,
        mentions: message.mentions,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };

      // Broadcast to channel room
      const room = channelId ? `channel:${channelId}` : `workspace:${workspaceId}`;
      io.to(room).emit("chat:new", { message: messageData });

      // Session Sync
      // Notify other sessions of the same user
      socket.to(`user:${userId}`).emit("message:sent:sync", { message: messageData });

      // Server Acknowledgment
      if (callback) callback({ status: "ok", messageId: message._id });

    } catch (error) {
      console.error("[Socket] chat:send error:", error);
      if (callback) callback({ status: "error", message: error.message });
    }
  });

  /**
   * Direct Messages
   */
  socket.on("dm:send", async (payload, callback) => {
    try {
      const { conversationId, content, tempId } = payload;
      if (!conversationId) throw new Error("Conversation ID is required");

      const message = await chatService.createDirectMessage({
        conversationId,
        senderId: userId,
        content
      });

      const messageData = {
        _id: message._id,
        tempId: tempId,
        conversation: conversationId,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt
      };

      // Broadcast to DM room
      io.to(`dm:${conversationId}`).emit("dm:new", { 
        message: messageData,
        conversation: conversationId 
      });

      // Sync other sessions
      socket.to(`user:${userId}`).emit("message:sent:sync", { message: messageData });

      if (callback) callback({ status: "ok", messageId: message._id });
    } catch (error) {
      if (callback) callback({ status: "error", message: error.message });
    }
  });

  /**
   * Delivery & Read Receipts
   */
  socket.on("message:read", async (payload) => {
    try {
      const { messageId, conversationId, channelId } = payload;
      // Update DB and broadcast
      // This would typically call a service to mark as read
      const room = conversationId ? `dm:${conversationId}` : `channel:${channelId}`;
      socket.to(room).emit("message:read:receipt", { messageId, userId, timestamp: new Date() });
    } catch (error) {
      // Ignore
    }
  });

  /**
   * Handle disconnect
   */
  socket.on("disconnect", (reason) => {
    socketService.removeSocket(userId, socket.id);
    const isStillOnline = socketService.isUserOnline(userId);

    if (!isStillOnline) {
      // Emit user:offline event
      Workspace.find({ "members.user": userId, isDeleted: false })
        .select("_id")
        .lean()
        .then(workspaces => {
          workspaces.forEach(ws => {
            const room = `workspace:${ws._id}`;
            io.to(room).emit("user:offline", {
              userId,
              timestamp: new Date()
            });
            // Group Member Left Event
            io.to(room).emit("group:memberLeft", { userId, timestamp: new Date() });
            
            presenceManager.removeUser(ws._id.toString(), userId);
            presenceManager.emitPresenceUpdate(io, ws._id.toString());
          });
        });
    }
  });
  /**
   * Chat: Typing indicator
   */
  socket.on("chat:typing", async (payload) => {
    try {
      const { channelId, conversationId } = payload;
      const room = channelId ? `channel:${channelId}` : `dm:${conversationId}`;
      if (!room) return;

      socket.to(room).emit("chat:user_typing", {
        channelId,
        conversationId,
        userId,
        userName,
      });
    } catch (error) {
      // Silently fail
    }
  });

  /**
   * Chat: Stop typing indicator
   */
  socket.on("chat:stop_typing", async (payload) => {
    try {
      const { channelId, conversationId } = payload;
      const room = channelId ? `channel:${channelId}` : `dm:${conversationId}`;
      if (!room) return;

      socket.to(room).emit("chat:user_stop_typing", {
        channelId,
        conversationId,
        userId,
      });
    } catch (error) {
      // Silently fail
    }
  });
};

module.exports = registerHandlers;

export {};
