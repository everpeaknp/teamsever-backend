jest.mock("../services/directMessageService", () => ({
  startConversation: jest.fn(),
  sendMessage: jest.fn(),
  getConversations: jest.fn(),
  getMessages: jest.fn(),
  getConversationById: jest.fn(),
  markConversationAsRead: jest.fn(),
  deleteMessage: jest.fn(),
}));

jest.mock("../services/entitlementService", () => ({
  __esModule: true,
  default: {
    canSendDirectMessage: jest.fn(),
    invalidateEntitlementCache: jest.fn(),
  },
}));

const directMessageService = require("../services/directMessageService");
const EntitlementService = require("../services/entitlementService").default;

const directMessageController = require("../controllers/directMessageController");

const flush = () => new Promise((resolve) => setImmediate(resolve));

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("directMessageController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a DM message for the authenticated sender", async () => {
    directMessageService.deleteMessage.mockResolvedValue({ _id: "message-1", isDeleted: true });
    const req: any = { user: { id: "user-1" }, params: { id: "message-1" } };
    const res = createRes();
    const next = jest.fn();

    directMessageController.deleteMessage(req, res, next);
    await flush();

    expect(directMessageService.deleteMessage).toHaveBeenCalledWith("message-1", "user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "message-1", isDeleted: true },
      message: "Message deleted",
    });
  });

  it("returns 400 when startConversation is missing workspaceId", async () => {
    const req: any = {
      user: { id: "user-1" },
      params: { userId: "user-2" },
      body: {},
      query: {},
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();

    directMessageController.startConversation(req, res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "workspaceId is required for direct messages",
    });
    expect(directMessageService.startConversation).not.toHaveBeenCalled();
  });

  it("starts a conversation using workspaceId from request body", async () => {
    directMessageService.startConversation.mockResolvedValue({ _id: "conversation-1" });

    const req: any = {
      user: { id: "user-1" },
      params: { userId: "user-2" },
      body: { workspaceId: "workspace-1" },
      query: {},
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();

    directMessageController.startConversation(req, res, next);
    await flush();

    expect(directMessageService.startConversation).toHaveBeenCalledWith(
      "user-1",
      "user-2",
      "workspace-1"
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "conversation-1" },
      message: "Conversation ready",
    });
  });

  it("returns pagination for conversation lists and enforces workspaceId", async () => {
    directMessageService.getConversations.mockResolvedValue({
      conversations: [{ _id: "conversation-1" }],
      pagination: { total: 1, page: 1, pages: 1, limit: 20, hasMore: false },
    });

    const req: any = {
      user: { id: "user-1" },
      params: {},
      body: {},
      query: { workspaceId: "workspace-1", page: "2", limit: "10" },
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();

    directMessageController.getConversations(req, res, next);
    await flush();

    expect(directMessageService.getConversations).toHaveBeenCalledWith(
      "user-1",
      "workspace-1",
      { page: 2, limit: 10, search: "", unreadOnly: false, clockedInOnly: false }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ _id: "conversation-1" }],
      count: 1,
      pagination: { total: 1, page: 1, pages: 1, limit: 20, hasMore: false },
    });
  });

  it("sends a DM using the entitlement gate and strict workspace scope", async () => {
    EntitlementService.canSendDirectMessage.mockResolvedValue({ allowed: true });
    directMessageService.sendMessage.mockResolvedValue({ _id: "message-1" });

    const req: any = {
      user: { id: "user-1" },
      params: { userId: "user-2" },
      body: { workspaceId: "workspace-1", content: "Hello" },
      query: {},
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();

    directMessageController.sendMessage(req, res, next);
    await flush();

    expect(EntitlementService.canSendDirectMessage).toHaveBeenCalledWith("user-1", "user-2");
    expect(directMessageService.sendMessage).toHaveBeenCalledWith({
      senderId: "user-1",
      targetUserId: "user-2",
      content: "Hello",
      workspaceId: "workspace-1",
    });
    expect(EntitlementService.invalidateEntitlementCache).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "message-1" },
      message: "Message sent successfully",
    });
  });

  it("returns 403 when the DM entitlement blocks sending", async () => {
    EntitlementService.canSendDirectMessage.mockResolvedValue({
      allowed: false,
      reason: "Blocked by plan",
    });

    const req: any = {
      user: { id: "user-1" },
      params: { userId: "user-2" },
      body: { workspaceId: "workspace-1", content: "Hello" },
      query: {},
      headers: {},
    };
    const res = createRes();
    const next = jest.fn();

    directMessageController.sendMessage(req, res, next);
    await flush();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Blocked by plan",
      code: "DM_LIMIT_REACHED",
    });
    expect(directMessageService.sendMessage).not.toHaveBeenCalled();
  });
});
