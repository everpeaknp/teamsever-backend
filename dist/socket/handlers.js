"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    const userId = socket.user.id;
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
                            userName: socket.user.name,
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
    }
    catch (error) {
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
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                isDeleted: false
            }).lean();
            if (!workspace) {
                socket.emit("error", { message: "Workspace not found" });
                return;
            }
            const isMember = workspace.members.some((member) => member.user.toString() === userId);
            if (!isMember) {
                socket.emit("error", { message: "Unauthorized: Not a workspace member" });
                return;
            }
            // Join workspace room
            const roomName = `workspace:${workspaceId}`;
            await socket.join(roomName);
            // Add to presence
            presenceManager.addUser(workspaceId, userId);
            presenceManager.emitPresenceUpdate(io, workspaceId);
            socket.emit("joined_workspace", { workspaceId, room: roomName });
        }
        catch (error) {
            socket.emit("error", { message: "Failed to join workspace" });
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
            const workspace = await Workspace.findOne({
                _id: space.workspace,
                isDeleted: false
            }).lean();
            if (!workspace) {
                socket.emit("error", { message: "Workspace not found" });
                return;
            }
            const isMember = workspace.members.some((member) => member.user.toString() === userId);
            if (!isMember) {
                socket.emit("error", { message: "Unauthorized: Not a workspace member" });
                return;
            }
            // Join space room
            const roomName = `space:${spaceId}`;
            await socket.join(roomName);
            socket.emit("joined_space", { spaceId, room: roomName });
        }
        catch (error) {
            socket.emit("error", { message: "Failed to join space" });
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
            const workspace = await Workspace.findOne({
                _id: task.workspace,
                isDeleted: false
            }).lean();
            if (!workspace) {
                socket.emit("error", { message: "Workspace not found" });
                return;
            }
            const isMember = workspace.members.some((member) => member.user.toString() === userId);
            if (!isMember) {
                socket.emit("error", { message: "Unauthorized: Not a workspace member" });
                return;
            }
            // Join task room
            const roomName = `task:${taskId}`;
            await socket.join(roomName);
            socket.emit("joined_task", { taskId, room: roomName });
        }
        catch (error) {
            socket.emit("error", { message: "Failed to join task" });
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
        }
        catch (error) {
            socket.emit("error", { message: "Failed to leave task" });
        }
    });
    /**
     * Handle disconnect
     */
    socket.on("disconnect", () => {
        // Remove socket from socket service
        socketService.removeSocket(userId, socket.id);
        // Check if user is still online (other devices)
        const isStillOnline = socketService.isUserOnline(userId);
        // If user is completely offline, emit user:offline event
        if (!isStillOnline) {
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
                        // Notify all workspace members that user is offline
                        workspace.members.forEach((member) => {
                            const memberId = member.user.toString();
                            if (memberId !== userId) {
                                socketService.emitToUser(memberId, "user:offline", {
                                    userId,
                                    userName: socket.user.name,
                                    workspaceId: workspace._id.toString(),
                                    timestamp: new Date(),
                                });
                            }
                        });
                    });
                })
                    .catch((error) => {
                    console.error("[Socket] Failed to emit user:offline event:", error);
                });
            }
            catch (error) {
                console.error("[Socket] Failed to emit user:offline event:", error);
            }
        }
        // Remove user from all workspace presence
        const affectedWorkspaces = presenceManager.removeUserFromAll(userId);
        // Emit presence updates to affected workspaces
        affectedWorkspaces.forEach((workspaceId) => {
            presenceManager.emitPresenceUpdate(io, workspaceId);
        });
    });
    /**
     * Chat: Send message
     */
    socket.on("chat:send", async (payload) => {
        try {
            const { workspaceId, content, mentions } = payload;
            if (!workspaceId) {
                socket.emit("error", { message: "Workspace ID is required" });
                return;
            }
            if (!content || content.trim().length === 0) {
                socket.emit("error", { message: "Message content is required" });
                return;
            }
            // Check message limit before creating message
            const limitCheck = await checkMessageLimitForWorkspace(workspaceId);
            if (!limitCheck.allowed) {
                socket.emit("error", limitCheck.error);
                return;
            }
            // Create message using service (validates membership)
            const message = await chatService.createMessage({
                workspaceId,
                senderId: userId, // Use authenticated user ID from socket
                content,
                mentions: mentions || [],
            });
            // Broadcast to workspace room
            io.to(`workspace:${workspaceId}`).emit("chat:new", {
                message: {
                    _id: message._id,
                    workspace: message.workspace,
                    sender: message.sender,
                    content: message.content,
                    type: message.type,
                    mentions: message.mentions,
                    createdAt: message.createdAt,
                    updatedAt: message.updatedAt,
                },
            });
        }
        catch (error) {
            socket.emit("error", {
                message: error.message || "Failed to send message"
            });
        }
    });
    /**
     * Chat: Typing indicator
     */
    socket.on("chat:typing", async (payload) => {
        try {
            const { workspaceId } = payload;
            if (!workspaceId) {
                return;
            }
            // Verify workspace membership
            const workspace = await Workspace.findOne({
                _id: workspaceId,
                isDeleted: false
            }).lean();
            if (!workspace) {
                return;
            }
            const isMember = workspace.members.some((member) => member.user.toString() === userId);
            if (!isMember) {
                return;
            }
            // Broadcast to workspace room except sender
            socket.to(`workspace:${workspaceId}`).emit("chat:user_typing", {
                workspaceId,
                userId,
                userName: socket.user.name,
            });
        }
        catch (error) {
            // Silently fail for typing indicators
        }
    });
    /**
     * Chat: Stop typing indicator
     */
    socket.on("chat:stop_typing", async (payload) => {
        try {
            const { workspaceId } = payload;
            if (!workspaceId) {
                return;
            }
            // Broadcast to workspace room except sender
            socket.to(`workspace:${workspaceId}`).emit("chat:user_stop_typing", {
                workspaceId,
                userId,
            });
        }
        catch (error) {
            // Silently fail for typing indicators
        }
    });
};
module.exports = registerHandlers;
