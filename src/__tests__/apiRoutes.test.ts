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

jest.mock("../utils/validation", () => {
  return jest.fn(() => (_req: any, _res: any, next: any) => next());
});

jest.mock("../services/directMessageService", () => ({
  startConversation: jest.fn(),
  sendMessage: jest.fn(),
  getConversations: jest.fn(),
  getMessages: jest.fn(),
  getConversationById: jest.fn(),
  markConversationAsRead: jest.fn(),
}));

jest.mock("../services/entitlementService", () => ({
  __esModule: true,
  default: {
    canSendDirectMessage: jest.fn(),
    invalidateEntitlementCache: jest.fn(),
  },
}));

jest.mock("../services/notificationService", () => ({
  getUserNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  getUnreadCount: jest.fn(),
  createNotification: jest.fn(),
}));

jest.mock("../services/invitationService", () => ({
  sendInvite: jest.fn(),
  verifyInvitation: jest.fn(),
  acceptInvite: jest.fn(),
  redeemByShortCode: jest.fn(),
  getWorkspaceInvitations: jest.fn(),
  cancelInvitation: jest.fn(),
  getUserInvitations: jest.fn(),
}));

jest.mock("../models/User", () => ({
  findById: jest.fn(),
}));

const directMessageService = require("../services/directMessageService");
const EntitlementService = require("../services/entitlementService").default;
const notificationService = require("../services/notificationService");
const invitationService = require("../services/invitationService");
const User = require("../models/User");

const { workspaceInvitationRouter, inviteRouter, publicInviteRouter } = require("../routes/invitationRoutes");
const directMessageRoutes = require("../routes/directMessageRoutes");
const notificationCenterRoutes = require("../routes/notificationCenterRoutes");

function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/dm", directMessageRoutes);
  app.use("/api/workspaces/:workspaceId/invites", workspaceInvitationRouter);
  app.use("/api/invites", inviteRouter);
  app.use("/api/invites", publicInviteRouter);
  app.use("/api/notifications", notificationCenterRoutes);

  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
      errorCode: err.errorCode || null,
    });
  });

  return app;
}

describe("HTTP route contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires workspaceId for the DM conversation list route", async () => {
    const app = createApp();

    const response = await request(app).get("/api/dm");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "workspaceId is required",
    });
    expect(directMessageService.getConversations).not.toHaveBeenCalled();
  });

  it("starts a DM conversation through the mounted route", async () => {
    directMessageService.startConversation.mockResolvedValue({ _id: "conversation-1" });

    const app = createApp();

    const response = await request(app)
      .post("/api/dm/user-2")
      .send({ workspaceId: "workspace-1" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Conversation ready",
      data: { _id: "conversation-1" },
    });
    expect(directMessageService.startConversation).toHaveBeenCalledWith("user-1", "user-2", "workspace-1");
  });

  it("sends a DM through the mounted message route", async () => {
    EntitlementService.canSendDirectMessage.mockResolvedValue({ allowed: true });
    directMessageService.sendMessage.mockResolvedValue({ _id: "message-1" });

    const app = createApp();

    const response = await request(app)
      .post("/api/dm/user-2/message")
      .send({ workspaceId: "workspace-1", content: "Hello from HTTP" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Message sent successfully",
      data: { _id: "message-1" },
    });
    expect(EntitlementService.canSendDirectMessage).toHaveBeenCalledWith("user-1", "user-2");
  });

  it("returns scoped notifications through the notification center route", async () => {
    notificationService.getUserNotifications.mockResolvedValue({
      notifications: [{ _id: "notification-1" }],
      pagination: { total: 1, unreadCount: 1, page: 1, pages: 1, limit: 20, hasMore: false },
    });

    const app = createApp();

    const response = await request(app)
      .get("/api/notifications")
      .query({ workspaceId: "workspace-1", unreadOnly: "true" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [{ _id: "notification-1" }],
      pagination: { total: 1, unreadCount: 1, page: 1, pages: 1, limit: 20, hasMore: false },
    });
    expect(notificationService.getUserNotifications).toHaveBeenCalledWith("user-1", {
      page: 1,
      limit: 20,
      unreadOnly: true,
      workspaceId: "workspace-1",
    });
  });

  it("creates a workspace invitation through the mounted route", async () => {
    invitationService.sendInvite.mockResolvedValue({ _id: "invite-1" });

    const app = createApp();

    const response = await request(app)
      .post("/api/workspaces/workspace-1/invites")
      .send({ email: "team@example.com", role: "admin" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: "Invitation sent to team@example.com",
      data: { _id: "invite-1" },
    });
    expect(invitationService.sendInvite).toHaveBeenCalledWith({
      email: "team@example.com",
      workspaceId: "workspace-1",
      role: "admin",
      invitedBy: "user-1",
    });
  });

  it("creates a short code for sharing and preserves its workspace access settings", async () => {
    invitationService.sendInvite.mockResolvedValue({
      _id: "invite-link-1",
      token: "secure-token",
      shortCode: "A1B2C3D4",
      inviteType: "link",
      spaceId: "space-1",
      spacePermissionLevel: "VIEW",
      expiresAt: "2026-10-10T00:00:00.000Z",
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/workspaces/workspace-1/invites")
      .send({
        inviteType: "link",
        role: "developer",
        expiresInHours: 168,
        spaceId: "space-1",
        spacePermissionLevel: "VIEW",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        _id: "invite-link-1",
        token: "secure-token",
        shortCode: "A1B2C3D4",
        inviteType: "link",
        spaceId: "space-1",
        spacePermissionLevel: "VIEW",
        expiresAt: "2026-10-10T00:00:00.000Z",
        inviteUrl: expect.stringMatching(/\/join\?token=secure-token$/),
      },
    });
    expect(invitationService.sendInvite).toHaveBeenCalledWith({
      role: "developer",
      workspaceId: "workspace-1",
      invitedBy: "user-1",
      inviteType: "link",
      expiresInHours: 168,
      spaceId: "space-1",
      spacePermissionLevel: "VIEW",
    });
  });

  it("accepts a workspace invitation through the mounted route", async () => {
    invitationService.acceptInvite.mockResolvedValue({
      workspace: { _id: "workspace-1", name: "Everacy", description: "Team" },
      role: "member",
      alreadyMember: false,
    });

    const app = createApp();

    const response = await request(app).post("/api/invites/accept/token-1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Successfully joined Everacy",
      data: {
        workspace: {
          _id: "workspace-1",
          name: "Everacy",
          description: "Team",
        },
        role: "member",
        alreadyMember: false,
      },
    });
    expect(invitationService.acceptInvite).toHaveBeenCalledWith("token-1", "user-1");
  });

  it("redeems a shared workspace code through the route used by web and mobile", async () => {
    invitationService.redeemByShortCode.mockResolvedValue({
      workspace: { _id: "workspace-1", name: "Everacy", description: "Team" },
      role: "member",
      alreadyMember: false,
      spaceId: "space-1",
      spaceName: "Design",
      spacePermissionLevel: "VIEW",
      spaceAlreadyMember: false,
    });

    const app = createApp();
    const response = await request(app)
      .post("/api/invites/redeem")
      .send({ code: " a1b2c3d4 " });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        workspace: { _id: "workspace-1", name: "Everacy" },
        spaceId: "space-1",
        spaceName: "Design",
        spacePermissionLevel: "VIEW",
        spaceAlreadyMember: false,
      },
    });
    expect(invitationService.redeemByShortCode).toHaveBeenCalledWith(
      "a1b2c3d4",
      "user-1",
    );
  });

  it("serves public invite verification without auth", async () => {
    User.findById.mockResolvedValue({ email: "team@example.com" });
    invitationService.verifyInvitation.mockResolvedValue({
      workspace: { name: "Everacy" },
      invitedBy: "Admin",
      role: "member",
    });

    const app = createApp();

    const response = await request(app).get("/api/invites/verify/token-1");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        workspace: { name: "Everacy" },
        invitedBy: "Admin",
        role: "member",
      },
    });
  });
});
