const express = require("express");
const request = require("supertest");

jest.mock("../middlewares/authMiddleware", () => ({
  protect: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: "user-1", _id: "user-1" };
    next();
  }),
}));

jest.mock("../permissions/permission.middleware", () => ({
  requirePermission: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock("../services/chatService", () => ({
  getChannels: jest.fn(),
  createChannel: jest.fn(),
  updateChannel: jest.fn(),
  deleteChannel: jest.fn(),
}));

const chatRoutes = require("../routes/chatRoutes");
const chatService = require("../services/chatService");

function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/workspaces/:workspaceId/chat", chatRoutes.workspaceChatRouter);

  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
      errorCode: err.errorCode || null,
    });
  });

  return app;
}

describe("Chat channel HTTP routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists channels with pagination", async () => {
    chatService.getChannels.mockResolvedValue({
      channels: [{ _id: "channel-1", name: "General" }],
      pagination: { total: 1, page: 1, pages: 1, limit: 30, hasMore: false },
    });

    const app = createApp();

    const response = await request(app)
      .get("/api/workspaces/workspace-1/chat/channels")
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [{ _id: "channel-1", name: "General" }],
      pagination: { total: 1, page: 1, pages: 1, limit: 30, hasMore: false },
    });
    expect(chatService.getChannels).toHaveBeenCalledWith("workspace-1", "user-1", {
      page: 1,
      limit: 10,
      search: "",
      unreadOnly: false,
      clockedInOnly: false,
    });
  });

  it("creates a new channel", async () => {
    chatService.createChannel.mockResolvedValue({ _id: "channel-2", name: "New" });

    const app = createApp();

    const response = await request(app)
      .post("/api/workspaces/workspace-1/chat/channels")
      .send({ name: "New Channel", description: "desc" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: { _id: "channel-2", name: "New" },
    });
    expect(chatService.createChannel).toHaveBeenCalledWith("workspace-1", "user-1", {
      name: "New Channel",
      description: "desc",
    });
  });

  it("deletes a channel", async () => {
    chatService.deleteChannel.mockResolvedValue({});

    const app = createApp();

    const response = await request(app).delete("/api/workspaces/workspace-1/chat/channels/channel-3");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true });
    expect(chatService.deleteChannel).toHaveBeenCalledWith("workspace-1", "channel-3", "user-1");
  });
});
