const dotenv = require("dotenv");
dotenv.config();

// ============================================================================
// GLOBAL ERROR HANDLERS - Catch all unhandled errors
// ============================================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  if (reason && typeof reason === 'object' && 'stack' in reason) {
    console.error('Stack:', reason.stack);
  } else {
    console.error('Stack: No stack trace available');
  }
  // DO NOT call process.exit() - let the server continue running
});

process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  // DO NOT call process.exit() - let the server continue running
});

// Verify environment variables are loaded
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}
const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger").default;
const connectDB = require("./config/db");
const cron = require("node-cron");

// ============================================================================
// ASYNC SERVER INITIALIZATION - Ensures MongoDB connects before starting server
// ============================================================================
const startServer = async () => {
  try {
    // 1. Connect to MongoDB FIRST
    await connectDB();

    // 2. Import routes and services AFTER MongoDB is connected
    const authRoutes = require("./routes/authRoutes");
    const sanitizeMiddleware = require("./middlewares/sanitizeMiddleware");
    const workspaceRoutes = require("./routes/workspaceRoutes");
    const { workspaceSpaceRouter, spaceRouter } = require("./routes/spaceRoutes");
    const spaceMemberRoutes = require("./routes/spaceMemberRoutes");
    const { spaceInvitationRouter, invitationRouter: spaceInvitationStandaloneRouter } = require("./routes/spaceInvitationRoutes");
    const { spaceFolderRouter, folderRouter } = require("./routes/folderRoutes");
    const folderMemberRoutes = require("./routes/folderMemberRoutes");
    const { spaceListRouter, listRouter } = require("./routes/listRoutes");
    const listMemberRoutes = require("./routes/listMemberRoutes");
    const { listTaskRouter, taskRouter } = require("./routes/taskRoutes");
    const { workspaceInvitationRouter, inviteRouter, publicInviteRouter } = require("./routes/invitationRoutes");
    const { workspaceChatRouter, channelRouter, chatRouter } = require("./routes/chatRoutes");
    const notificationRoutes = require("./routes/notificationRoutes");
    const notificationCenterRoutes = require("./routes/notificationCenterRoutes");
    const presenceRoutes = require("./routes/presenceRoutes");
    const { taskCommentRouter, commentRouter } = require("./routes/commentRoutes");
    const directMessageRoutes = require("./routes/directMessageRoutes");
    const uploadRoutes = require("./routes/uploadRoutes");
    const customFieldRouter = require("./routes/customFieldRoutes");
    const taskDependencyRoutes = require("./routes/taskDependencyRoutes");
    const timeEntryRoutes = require("./routes/timeEntryRoutes");
    const recurringRoutes = require("./routes/recurringRoutes");
    const attachmentRoutes = require("./routes/attachmentRoutes");
    const activityRoutes = require("./routes/activityRoutes");
    const searchRoutes = require("./routes/searchRoutes");
    const timeTrackingRoutes = require("./routes/timeTrackingRoutes");
    const attendanceRoutes = require("./routes/attendanceRoutes");
    const memberRoutes = require("./routes/memberRoutes");
    const documentRoutes = require("./routes/documentRoutes");
    const performanceRoutes = require("./routes/performanceRoutes");
    const planRoutes = require("./routes/planRoutes");
    const superAdminRoutes = require("./routes/superAdminRoutes");
    const userRoutes = require("./routes/userRoutes");
    const subscriptionRoutes = require("./routes/subscriptionRoutes");
    const feedbackRoutes = require("./routes/feedbackRoutes");
    const { workspaceFileRouter, fileRouter } = require("./routes/workspaceFileRoutes");
    const { spaceTableRouter, tableRouter } = require("./routes/customTableRoutes");
    const tableMemberRoutes = require("./routes/tableMemberRoutes");
    const entitlementRoutes = require("./routes/entitlementRoutes");
    const paymentRoutes = require("./routes/paymentRoutes");
    const webhookRoutes = require("./routes/webhookRoutes");
    const initializeSocketIO = require("./socket");
    const { initializeFirebase } = require("./config/firebase");
    const recurringService = require("./services/recurringService");

    // 2. Initialize Firebase Admin SDK
    initializeFirebase();

    // 3. Setup Express app
    const app = express();
    const httpServer = http.createServer(app);

    // 4. Initialize Socket.io
    const io = initializeSocketIO(httpServer);
    app.set("io", io);

    // 5. CORS configuration
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      "http://localhost:3000",
      "https://teamsever.vercel.app",
      "https://teamsever-frontend.vercel.app",
      "https://teamsever-frontend-d22u.vercel.app"
    ].filter(Boolean);

    const corsOptions = {
      origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200
    };
    app.use(cors(corsOptions));
    app.options(/.*/, cors(corsOptions));

    // 6. Rate limiting — tiered by endpoint sensitivity
    // Auth endpoints: 20 requests per 15 min (brute-force protection)
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      skip: (req) => req.method === "OPTIONS",
      message: { success: false, message: "Too many authentication attempts. Try again later." }
    });
    // General API: 500 requests per 15 min per IP
    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      skip: (req) => req.method === "OPTIONS",
      message: { success: false, message: "Too many requests from this IP. Try again later." }
    });
    app.use("/api/auth/login", authLimiter);
    app.use("/api/auth/register", authLimiter);
    app.use("/api/auth/forgot-password", authLimiter);
    app.use("/api/", generalLimiter);

    // 6.1. Response compression — reduces bandwidth by 60-80%
    app.use(compression());

    // 6.2. Request logging
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

    app.use(express.json());

    // 6.5. NoSQL Injection Protection - MUST be after express.json() and before routes
    app.use(sanitizeMiddleware); // Custom middleware compatible with Express v5

    app.get("/", (_req, res) => {
      res.send("API is running...");
    });

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Swagger API Documentation
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: "Workspace App API Documentation"
    }));

    // 7. Routes
    app.use("/api/auth", authRoutes);
    app.use("/api/workspaces", workspaceRoutes);
    app.use("/api/workspaces/:workspaceId/spaces", workspaceSpaceRouter);
    app.use("/api/spaces", spaceRouter);
    app.use("/api/spaces/:spaceId/space-members", spaceMemberRoutes);
    app.use("/api/spaces/:spaceId/invitations", spaceInvitationRouter);
    app.use("/api/space-invitations", spaceInvitationStandaloneRouter);
    app.use("/api/spaces/:spaceId/folders", spaceFolderRouter);
    app.use("/api/folders", folderRouter);
    app.use("/api/folders/:folderId/folder-members", folderMemberRoutes);
    app.use("/api/spaces/:spaceId/lists", spaceListRouter);
    app.use("/api/lists", listRouter);
    app.use("/api/lists/:listId/list-members", listMemberRoutes);
    app.use("/api/lists/:listId/tasks", listTaskRouter);
    app.use("/api/tasks", taskRouter);
    // OLD COMMENT SYSTEM - REPLACED BY ACTIVITY SYSTEM
    // app.use("/api/tasks/:taskId/comments", taskCommentRouter);
    // app.use("/api/comments", commentRouter);
    app.use("/api/dm", directMessageRoutes);
    app.use("/api/workspaces/:workspaceId/invites", workspaceInvitationRouter);
    app.use("/api/workspaces/:workspaceId/chat", workspaceChatRouter);
    app.use("/api/invites", inviteRouter);
    app.use("/api/chat/channels", channelRouter);
    app.use("/api/chat", chatRouter);
    app.use("/api/notifications/devices", notificationRoutes);
    app.use("/api/notifications", notificationCenterRoutes);
    app.use("/api/presence", presenceRoutes);
    app.use("/api", uploadRoutes);
    app.use("/api/custom-fields", customFieldRouter);
    app.use("/api/task-dependencies", taskDependencyRoutes);
    app.use("/api/time", timeEntryRoutes);
    app.use("/api/recurring", recurringRoutes);
    app.use("/api/attendance", attendanceRoutes);
    app.use("/api", attachmentRoutes);
    app.use("/api", activityRoutes);
    app.use("/api/search", searchRoutes);
    app.use("/api/tasks", timeTrackingRoutes);
    app.use("/api/workspaces/:workspaceId/members", memberRoutes);
    app.use("/api/docs", documentRoutes);
    app.use("/api/invites", publicInviteRouter);
    app.use("/api/performance", performanceRoutes);
    app.use("/api/plans", planRoutes);
    app.use("/api/super-admin", superAdminRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/subscription", subscriptionRoutes);
    app.use("/api/feedback", feedbackRoutes);
    app.use("/api/workspaces/:workspaceId/files", workspaceFileRouter);
    app.use("/api/workspace-files", fileRouter);
    app.use("/api/spaces/:spaceId/tables", spaceTableRouter);
    app.use("/api/tables", tableRouter);
    app.use("/api/currency", require("./routes/currencyRoutes"));
    app.use("/api/tables/:tableId/table-members", tableMemberRoutes);
    app.use("/api/entitlements", entitlementRoutes);
    app.use("/api/payment", paymentRoutes);
    app.use("/api/webhooks", webhookRoutes);

    // Error handler middleware (must be last)
    const errorHandler = require("./middlewares/errorMiddleware");
    app.use(errorHandler);

    // 8. Start HTTP server
    const PORT = Number(process.env.PORT) || 5000;
    httpServer.listen(PORT, () => {
      console.log(`[Server] HTTP server running on port ${PORT}`);
      console.log(`[Server] WebSocket server ready`);

      // Initialize recurring task cron job
      cron.schedule("0 * * * *", async () => {
        console.log("[Cron] Running recurring task processor...");
        try {
          const result = await recurringService.processRecurringTasks();
          console.log(`[Cron] Recurring tasks processed: ${result.created} created, ${result.errors} errors`);
        } catch (error) {
          console.error("[Cron] Error processing recurring tasks:", error);
        }
      });
      console.log("[Cron] Recurring task processor scheduled (runs every hour)");

      // Initialize subscription expiry check cron job (runs every hour)
      cron.schedule("0 * * * *", async () => {
        try {
          const User = require("./models/User");
          const now = new Date();

          // Single updateMany instead of N+1 individual saves
          const result = await User.updateMany(
            {
              'subscription.isPaid': true,
              'subscription.status': 'active',
              'subscription.expiresAt': { $lte: now }
            },
            {
              $set: {
                'subscription.status': 'expired',
                'subscription.isPaid': false,
              }
            }
          );

          if (result.modifiedCount > 0) {
            console.log(`[Cron] ${result.modifiedCount} subscriptions expired`);
          }
        } catch (error) {
          console.error("[Cron] Error checking subscription expiry:", error);
        }
      });
      console.log("[Cron] Subscription expiry checker scheduled (runs every hour)");
    });

    // Return for graceful shutdown
    return { httpServer, io };
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
};

// Start the server
let httpServer, io;
startServer().then((servers) => {
  httpServer = servers.httpServer;
  io = servers.io;
}).catch((error) => {
  console.error("[Server] Startup error:", error);
  process.exit(1);
});
// ============================================================================
// GRACEFUL SHUTDOWN - Safe cleanup even if modules are missing
// ============================================================================
const gracefulShutdown = async (signal) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);

  // Close socket connections first to prevent "User Disconnected" flood
  try {
    console.log('[Server] Closing socket connections...');
    if (io) {
      // Disconnect all sockets
      io.disconnectSockets();
      console.log('[Server] ✓ All socket connections closed');
    }
  } catch (error) {
    console.error('[Server] Error closing sockets:', error);
  }

  // All cleanup done - no queues, workers, or Redis to close

  // Close HTTP server
  httpServer.close(() => {
    console.log("[Server] ✓ HTTP server closed");
    console.log("[Server] Shutdown complete");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error("[Server] ⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { };
