jest.mock("../models/Notification", () => ({
  countDocuments: jest.fn(),
  deleteMany: jest.fn(),
  distinct: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock("../models/Announcement", () => ({
  find: jest.fn(),
}));
jest.mock("../models/DeviceToken", () => ({}));
jest.mock("../config/firebase", () => ({
  getMessaging: jest.fn(),
  isFirebaseConfigured: jest.fn(() => false),
}));
jest.mock("../socket/presence", () => ({}));
jest.mock("../utils/logger", () => ({}));
jest.mock("../socket/events", () => ({ emitToUser: jest.fn() }));
jest.mock("../services/enhancedNotificationService", () => ({}));
jest.mock("../models/Workspace", () => ({ find: jest.fn() }));

const Notification = require("../models/Notification");
const Announcement = require("../models/Announcement");
const notificationService = require("../services/notificationService");

describe("announcement notification cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes all recipient notices linked to a deleted announcement", async () => {
    Notification.deleteMany.mockResolvedValue({ deletedCount: 4 });

    await notificationService.deleteAnnouncementNotifications("announcement-1");

    expect(Notification.deleteMany).toHaveBeenCalledWith({
      type: "ANNOUNCEMENT_NEW",
      "data.announcementId": "announcement-1",
    });
  });

  it("removes orphaned announcement notices before returning the feed", async () => {
    Notification.distinct.mockResolvedValue(["announcement-live", "announcement-deleted"]);
    Announcement.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: "announcement-live" }]),
      }),
    });
    Notification.deleteMany.mockResolvedValue({ deletedCount: 1 });
    Notification.countDocuments.mockResolvedValue(0);
    Notification.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    });

    const result = await notificationService.getUserNotifications("user-1", {
      workspaceId: "workspace-1",
    });

    expect(Notification.deleteMany).toHaveBeenCalledWith({
      recipient: "user-1",
      type: "ANNOUNCEMENT_NEW",
      "data.workspaceId": "workspace-1",
      "data.announcementId": { $in: ["announcement-deleted"] },
    });
    expect(result.notifications).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it("acknowledges every duplicate notice for the same recipient and announcement", async () => {
    const savedNotice = {
      _id: "notification-1",
      recipient: "user-1",
      type: "ANNOUNCEMENT_NEW",
      data: { announcementId: "announcement-1" },
      read: false,
      readAt: null,
      acknowledgedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Notification.findOne.mockResolvedValue(savedNotice);
    Notification.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const result = await notificationService.acknowledgeNotification(
      "notification-1",
      "user-1"
    );

    expect(Notification.updateMany).toHaveBeenCalledWith(
      {
        recipient: "user-1",
        type: "ANNOUNCEMENT_NEW",
        "data.announcementId": "announcement-1",
      },
      {
        $set: {
          acknowledgedAt: expect.any(Date),
          read: true,
          readAt: expect.any(Date),
        },
      }
    );
    expect(result.acknowledgedAt).toEqual(expect.any(Date));
  });
});
