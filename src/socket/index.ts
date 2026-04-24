import { Server } from "socket.io";

const socketAuthMiddleware = require("./auth");
const registerHandlers = require("./handlers");
const { initializeSocket } = require("./events");

/**
 * Initialize Socket.io server
 */
const initializeSocketIO = (httpServer: any) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "https://teamsever.vercel.app",
    "https://teamsever-frontend.vercel.app",
    "https://teamsever-frontend-d22u.vercel.app"
  ].filter(Boolean) as string[];

  // Socket.io configuration
  const socketOptions = {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    },
    // Connection settings - Heartbeat/Ping-Pong
    pingTimeout: 60000,
    pingInterval: 25000,
    // Upgrade settings
    transports: ["websocket" as const, "polling" as const],
    allowUpgrades: true,
    // Max buffer size for large file transfers if needed
    maxHttpBufferSize: 1e7 // 10MB
  };

  const io = new Server(httpServer, socketOptions);

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on("connection", (socket: any) => {
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
