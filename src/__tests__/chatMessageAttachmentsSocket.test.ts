jest.mock("../models/ChatMessage", () => ({ create: jest.fn() }));
jest.mock("../models/ChatChannel", () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock("../models/Workspace", () => ({}));
jest.mock("../models/User", () => ({}));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));
jest.mock("../services/enhancedNotificationService", () => ({ createNotification: jest.fn() }));
jest.mock("../services/entitlementService", () => ({ default: {} }));
jest.mock("../services/planInheritanceService", () => ({ default: {} }));
jest.mock("../services/socketService", () => ({ default: {} }));
jest.mock("../socket/events", () => ({ emitChatMessage: jest.fn() }));

const ChatMessage = require("../models/ChatMessage");
const chatEvents = require("../socket/events");
const chatService = require("../services/chatService");

describe("group chat image message socket payload", () => {
  beforeEach(() => jest.clearAllMocks());

  it("includes uploaded attachments when broadcasting a message", async () => {
    const attachments = ["https://res.cloudinary.com/teamsever/image/upload/chat-images/workspace-1/photo.jpg"];
    const message = {
      _id: "message-1",
      workspace: "workspace-1",
      sender: { _id: "user-1", name: "Ramon" },
      content: "",
      attachments,
      type: "text",
      mentions: [],
      replyTo: null,
      createdAt: new Date("2026-10-27T00:00:00.000Z"),
      populate: jest.fn().mockReturnThis(),
    };
    ChatMessage.create.mockResolvedValue(message);
    const channel = { _id: "channel-1", workspace: "workspace-1", name: "General" };
    jest.spyOn(chatService, "validateChannelAccess").mockResolvedValue(channel);

    await chatService.createMessage({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      senderId: "user-1",
      content: "",
      attachments,
    });

    expect(chatEvents.emitChatMessage).toHaveBeenCalledWith(
      "channel-1",
      expect.objectContaining({ attachments }),
      "workspace-1",
    );
  });
});
