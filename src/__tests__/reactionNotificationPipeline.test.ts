jest.mock("../models/Notification", () => ({ create: jest.fn() }));
jest.mock("../models/DeviceToken", () => ({ find: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/Task", () => ({}));
jest.mock("../models/Workspace", () => ({}));
jest.mock("../models/Conversation", () => ({}));
jest.mock("../config/firebase", () => ({
  getMessaging: jest.fn(),
  isFirebaseConfigured: jest.fn(() => false),
}));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));
jest.mock("../services/socketService", () => ({
  __esModule: true,
  default: { emitToUser: jest.fn(), isUserOnline: jest.fn(() => true) },
}));

const Notification = require("../models/Notification");
const User = require("../models/User");
const service = require("../services/enhancedNotificationService");

describe("message reaction notification pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("formats DM reactions and includes message, conversation, and workspace ids", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ name: "Alex" }),
    });
    const createNotification = jest
      .spyOn(service, "createNotification")
      .mockResolvedValue(undefined);

    await service.notifyMessageReaction({
      type: "DM_REACTION",
      recipientId: "author-1",
      actorId: "actor-1",
      messageId: "message-1",
      conversationId: "conversation-1",
      workspaceId: "workspace-1",
      emoji: "❤️",
    });

    expect(createNotification).toHaveBeenCalledWith({
      recipientId: "author-1",
      type: "DM_REACTION",
      title: "Alex reacted to your message",
      body: "Reacted with ❤️",
      data: expect.objectContaining({
        resourceId: "message-1",
        resourceType: "DirectMessage",
        messageId: "message-1",
        conversationId: "conversation-1",
        workspaceId: "workspace-1",
        actorId: "actor-1",
        actorName: "Alex",
        emoji: "❤️",
      }),
    });
  });

  it("formats group reactions with the channel in the notification", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ name: "Sam" }),
    });
    const createNotification = jest
      .spyOn(service, "createNotification")
      .mockResolvedValue(undefined);

    await service.notifyMessageReaction({
      type: "GROUP_CHAT_REACTION",
      recipientId: "author-1",
      actorId: "actor-1",
      messageId: "message-1",
      channelId: "channel-1",
      channelName: "Design",
      workspaceId: "workspace-1",
      emoji: "👏",
    });

    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: "author-1",
      type: "GROUP_CHAT_REACTION",
      title: "Sam reacted to a message",
      body: "in #Design with 👏",
      data: expect.objectContaining({
        resourceType: "ChatMessage",
        messageId: "message-1",
        channelId: "channel-1",
        channelName: "Design",
        workspaceId: "workspace-1",
      }),
    }));
  });

  it("pushes workspace invitations to mobile devices even when the recipient is online", async () => {
    jest.restoreAllMocks();
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({}),
    });
    const notification = {
      _id: { toString: () => "notification-1" },
      recipient: "user-1",
      type: "INVITATION",
      title: "Workspace Invitation",
      body: "Admin invited you to join Everacy",
      data: { workspaceId: "workspace-1", token: "invite-token" },
      read: false,
      createdAt: new Date("2026-10-29T12:00:00.000Z"),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    Notification.create.mockResolvedValue(notification);
    const sendPush = jest
      .spyOn(service as any, "sendPushNotification")
      .mockResolvedValue(true);

    await service.createNotification({
      recipientId: "user-1",
      type: "INVITATION",
      title: "Workspace Invitation",
      body: "Admin invited you to join Everacy",
      data: { workspaceId: "workspace-1", token: "invite-token" },
    });

    expect(sendPush).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Workspace Invitation",
        platforms: ["android", "ios"],
        data: expect.objectContaining({
          type: "INVITATION",
          notificationId: "notification-1",
          workspaceId: "workspace-1",
          token: "invite-token",
        }),
      }),
    );
    sendPush.mockRestore();
  });

  it("does not create reaction notifications when message preferences are disabled", async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        notificationPreferences: { messages: false, groupChats: false },
      }),
    });

    await service.createNotification({
      recipientId: "user-1",
      type: "DM_REACTION",
      title: "Alex reacted to your message",
      body: "Reacted with ❤️",
    });
    await service.createNotification({
      recipientId: "user-1",
      type: "GROUP_CHAT_REACTION",
      title: "Alex reacted to a message",
      body: "in #Design with 👏",
      data: { channelId: "channel-1" },
    });

    expect(Notification.create).not.toHaveBeenCalled();
  });
});
