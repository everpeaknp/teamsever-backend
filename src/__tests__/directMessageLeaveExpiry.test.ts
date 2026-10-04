jest.mock("mongoose", () => ({}));
jest.mock("../models/Conversation", () => ({ findById: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ countDocuments: jest.fn(), find: jest.fn(), updateMany: jest.fn() }));
jest.mock("../models/User", () => ({}));
jest.mock("../models/Workspace", () => ({}));
jest.mock("../services/leaveService", () => ({ expireWorkspaceRequests: jest.fn() }));
jest.mock("../utils/logger", () => ({}));
jest.mock("../services/enhancedNotificationService", () => ({}));
jest.mock("../socket/events", () => ({ emitToUser: jest.fn() }));
jest.mock("../services/socketService", () => ({ default: { getIO: jest.fn(() => null) } }));

const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const leaveService = require("../services/leaveService");
const directMessageService = require("../services/directMessageService");

describe("DM leave request status refresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("expires workspace requests before returning authorized conversation messages", async () => {
    const calls: string[] = [];
    const conversationQuery = { lean: jest.fn().mockResolvedValue({ participants: ["user-1"], workspace: "workspace-1" }) };
    Conversation.findById.mockReturnValue(conversationQuery);
    leaveService.expireWorkspaceRequests.mockImplementation(async () => { calls.push("expire"); });
    DirectMessage.countDocuments.mockImplementation(async () => { calls.push("count"); return 0; });
    const messageQuery: any = {
      populate: jest.fn(() => messageQuery), sort: jest.fn(() => messageQuery),
      skip: jest.fn(() => messageQuery), limit: jest.fn(() => messageQuery),
      lean: jest.fn(async () => { calls.push("messages"); return []; }),
    };
    DirectMessage.find.mockReturnValue(messageQuery);
    DirectMessage.updateMany.mockResolvedValue({});

    await directMessageService.getMessages("conversation-1", "user-1", { workspaceId: "workspace-1" });

    expect(leaveService.expireWorkspaceRequests).toHaveBeenCalledWith("workspace-1");
    expect(calls).toEqual(["expire", "count", "messages"]);
  });

  it("does not run an expiry sweep for an unauthorized conversation", async () => {
    Conversation.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue({ participants: ["other-user"], workspace: "workspace-1" }) });
    await expect(directMessageService.getMessages("conversation-1", "user-1", { workspaceId: "workspace-1" })).rejects.toMatchObject({ statusCode: 403 });
    expect(leaveService.expireWorkspaceRequests).not.toHaveBeenCalled();
  });
});
