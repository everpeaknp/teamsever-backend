"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const socketAuthMiddleware = require("./auth");
const registerHandlers = require("./handlers");
const { initializeSocket } = require("./events");
/**
 * Initialize Socket.io server
 */
const initializeSocketIO = (httpServer) => {
    // Socket.io configuration
    const socketOptions = {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
            methods: ["GET", "POST"]
        },
        // Connection settings
        pingTimeout: 60000,
        pingInterval: 25000,
        // Upgrade settings
        transports: ["websocket", "polling"],
        allowUpgrades: true
    };
    const io = new socket_io_1.Server(httpServer, socketOptions);
    // Apply authentication middleware
    io.use(socketAuthMiddleware);
    // Handle connections
    io.on("connection", (socket) => {
        const userId = socket.user?.id;
        const userName = socket.user?.name;
        // Register event handlers
        registerHandlers(io, socket);
        // Handle errors
        socket.on("error", (error) => {
            console.error(`[Socket.io] Socket error for user ${userId}:`, error);
        });
        // Log disconnect (only for unexpected disconnects)
        socket.on("disconnect", (reason) => {
            // Only log if it's not a normal client disconnect or server shutdown
            if (reason !== 'client namespace disconnect' &&
                reason !== 'server namespace disconnect' &&
                reason !== 'transport close') {
                console.log(`[Socket.io] User disconnected: ${userName} (${userId}) - Reason: ${reason}`);
            }
        });
    });
    // Initialize event emitters
    initializeSocket(io);
    console.log("[Socket.io] Server initialized successfully");
    return io;
};
module.exports = initializeSocketIO;
