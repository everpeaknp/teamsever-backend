jest.mock("../models/Notification", () => ({ create: jest.fn() }));
jest.mock("../models/DeviceToken", () => ({ deleteMany: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/Task", () => ({}));
jest.mock("../models/Workspace", () => ({}));
jest.mock("../models/Conversation", () => ({}));
jest.mock("../services/socketService", () => ({
  __esModule: true,
  default: { emitToUser: jest.fn(), isUserOnline: jest.fn() },
}));
jest.mock("../config/firebase", () => ({ getMessaging: jest.fn(), isFirebaseConfigured: jest.fn() }));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));

const Notification = require("../models/Notification");
const User = require("../models/User");
const socketService = require("../services/socketService").default;
const notificationModule = require("../services/enhancedNotificationService");
const notifications = notificationModule.default || notificationModule;

describe("leave notification delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });
    socketService.isUserOnline.mockReturnValue(true);
    Notification.create.mockResolvedValue({
      _id: { toString: () => "notification-1" },
      type: "LEAVE_APPROVED",
      title: "Leave approved",
      body: "Approved",
      data: { workspaceId: "workspace-1" },
      read: false,
      createdAt: new Date(),
      populate: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("sends FCM for leave decisions even when another client session is online", async () => {
    const push = jest.spyOn(notifications, "sendPushNotification").mockResolvedValue(true);

    await notifications.createNotification({
      recipientId: "requester-1",
      type: "LEAVE_APPROVED",
      title: "Leave approved",
      body: "Approved",
      data: { workspaceId: "workspace-1", conversationId: "conversation-1" },
    });

    expect(socketService.emitToUser).toHaveBeenCalledWith("requester-1", "notification:new", expect.any(Object));
    expect(push).toHaveBeenCalledWith("requester-1", expect.objectContaining({
      title: "Leave approved",
      data: expect.objectContaining({ notificationId: "notification-1", conversationId: "conversation-1" }),
    }));
    push.mockRestore();
  });

  it("notifies only the requester when a request is denied", async () => {
    const create = jest.spyOn(notifications, "createNotification").mockResolvedValue({});
    await notifications.notifyLeaveDenied({
      _id: "leave-1",
      requester: { _id: "requester-1", name: "Requester" },
      requestType: "leave",
      startDate: new Date("2026-10-06T00:00:00Z"),
      endDate: new Date("2026-10-06T00:00:00Z"),
      denialReason: "Coverage",
      conversation: "conversation-1",
    }, { _id: "manager-1", name: "Manager" }, { _id: "workspace-1" }, ["requester-1", "manager-1", "manager-2"]);

    expect(create.mock.calls.map(([notification]: any[]) => notification.recipientId)).toEqual(["requester-1"]);
    create.mockRestore();
  });

  it("routes a private DM request only to its assigned manager", async () => {
    const create = jest.spyOn(notifications, "createNotification").mockResolvedValue({});
    await notifications.notifyLeaveRequested({
      _id: "leave-2",
      requester: { _id: "requester-1", name: "Requester" },
      assignedManager: { _id: "manager-1" },
      conversation: "conversation-2",
      requestType: "remote",
      startDate: new Date("2026-10-06T00:00:00Z"),
      endDate: new Date("2026-10-06T00:00:00Z"),
    }, { _id: "workspace-1" }, ["manager-1", "manager-2"]);

    expect(create.mock.calls.map(([notification]: any[]) => notification.recipientId)).toEqual(["manager-1"]);
    expect(create.mock.calls[0][0].data.conversationId).toBe("conversation-2");
    create.mockRestore();
  });

  it("includes the reason in manager notifications after remote approval", async () => {
    const create = jest.spyOn(notifications, "createNotification").mockResolvedValue({});
    await notifications.notifyLeaveApproved({
      _id: "leave-3",
      requester: { _id: "requester-1", name: "Requester" },
      requestType: "remote",
      reason: "Plumbing repair",
      startDate: new Date("2026-10-06T00:00:00Z"),
      endDate: new Date("2026-10-06T00:00:00Z"),
    }, { _id: "manager-1", name: "Manager" }, { _id: "workspace-1" }, ["requester-1", "manager-1", "manager-2"]);

    expect(create.mock.calls.map(([notification]: any[]) => notification.recipientId)).toEqual(["requester-1", "manager-2"]);
    expect(create.mock.calls[1][0].body).toContain("Reason: \"Plumbing repair\"");
    create.mockRestore();
  });
});
