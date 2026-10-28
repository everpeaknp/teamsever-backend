jest.mock("../models/ChatMessage", () => ({ findOne: jest.fn() }));
jest.mock("../models/ChatChannel", () => ({ findOne: jest.fn() }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/Conversation", () => ({ findById: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ findById: jest.fn() }));
jest.mock("../services/enhancedNotificationService", () => ({
  notifyMessageReaction: jest.fn(),
}));
jest.mock("../services/planInheritanceService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../services/entitlementService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));
jest.mock("../utils/softDelete", () => jest.fn());
jest.mock("../services/apiReadCacheService", () => ({
  __esModule: true,
  default: { invalidateNamespace: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../services/socketService", () => ({
  __esModule: true,
  default: Object.assign({
    getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
    emitToUsers: jest.fn(),
  }, { emitToUsers: jest.fn() }),
}));
jest.mock("../services/leaveService", () => ({}));
jest.mock("../socket/events", () => ({ emitToUser: jest.fn() }));

const ChatMessage = require("../models/ChatMessage");
const chatService = require("../services/chatService");
const directMessageService = require("../services/directMessageService");
const DirectMessage = require("../models/DirectMessage");
const Conversation = require("../models/Conversation");
const notifications = require("../services/enhancedNotificationService");

describe("group chat reaction notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notifies the message author with channel context when another member reacts", async () => {
    const channel = {
      _id: "channel-1",
      name: "Design",
      workspace: "workspace-1",
    };
    const message: any = {
      _id: "message-1",
      channel: "channel-1",
      workspace: "workspace-1",
      sender: "author-1",
      reactions: [],
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    ChatMessage.findOne.mockResolvedValue(message);
    jest.spyOn(chatService, "validateChannelAccess").mockResolvedValue(channel);

    await chatService.toggleReaction("message-1", "reactor-1", "👏");

    expect(notifications.notifyMessageReaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GROUP_CHAT_REACTION",
        recipientId: "author-1",
        actorId: "reactor-1",
        messageId: "message-1",
        channelId: "channel-1",
        channelName: "Design",
        workspaceId: "workspace-1",
        emoji: "👏",
      }),
    );
  });

  it("notifies the other DM participant when a reaction is added", async () => {
    const message: any = {
      _id: "dm-message-1",
      conversation: "conversation-1",
      sender: "author-1",
      reactions: [],
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    DirectMessage.findById.mockResolvedValue(message);
    Conversation.findById.mockResolvedValue({
      _id: "conversation-1",
      workspace: "workspace-1",
      participants: ["author-1", "reactor-1"],
    });

    await directMessageService.toggleReaction("dm-message-1", "reactor-1", "❤️");

    expect(notifications.notifyMessageReaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DM_REACTION",
        recipientId: "author-1",
        actorId: "reactor-1",
        messageId: "dm-message-1",
        conversationId: "conversation-1",
        workspaceId: "workspace-1",
        emoji: "❤️",
      }),
    );
  });

  it("does not notify on a self-reaction or reaction removal", async () => {
    const message: any = {
      _id: "dm-message-1",
      conversation: "conversation-1",
      sender: "reactor-1",
      reactions: [],
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    DirectMessage.findById.mockResolvedValue(message);
    Conversation.findById.mockResolvedValue({ participants: ["reactor-1", "other-1"] });

    await directMessageService.toggleReaction("dm-message-1", "reactor-1", "❤️");
    expect(notifications.notifyMessageReaction).not.toHaveBeenCalled();

    message.sender = "other-1";
    message.reactions = [{ emoji: "❤️", users: ["reactor-1"], count: 1 }];
    await directMessageService.toggleReaction("dm-message-1", "reactor-1", "❤️");
    expect(notifications.notifyMessageReaction).not.toHaveBeenCalled();
  });

  it("notifies when a DM participant changes their reaction emoji", async () => {
    const message: any = {
      _id: "dm-message-1",
      conversation: "conversation-1",
      sender: "author-1",
      reactions: [{ emoji: "👍", users: ["reactor-1"], count: 1 }],
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    DirectMessage.findById.mockResolvedValue(message);
    Conversation.findById.mockResolvedValue({ participants: ["author-1", "reactor-1"] });

    await directMessageService.toggleReaction("dm-message-1", "reactor-1", "🔥");

    expect(notifications.notifyMessageReaction).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "author-1", emoji: "🔥" }),
    );
  });
});
