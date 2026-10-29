jest.mock("../models/Notification", () => ({ create: jest.fn() }));
jest.mock("../models/DeviceToken", () => ({}));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/Task", () => ({}));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/Conversation", () => ({}));
jest.mock("../services/socketService", () => ({
  __esModule: true,
  default: { emitToUser: jest.fn(), isUserOnline: jest.fn() },
}));
jest.mock("../config/firebase", () => ({
  getMessaging: jest.fn(),
  isFirebaseConfigured: jest.fn(() => false),
}));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn() }));

const User = require("../models/User");
const Workspace = require("../models/Workspace");
const notificationModule = require("../services/enhancedNotificationService");
const notifications = notificationModule.default || notificationModule;

describe("announcement notification creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Workspace.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          name: "Everacy",
          members: [
            { user: "author-1", role: "owner" },
            { user: "recipient-1", role: "member" },
            { user: "recipient-1", role: "member" },
          ],
        }),
      }),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          name: "Owner",
          notificationPreferences: { notices: true },
        }),
      }),
    });
  });

  it("creates only one notice per recipient when membership rows are duplicated", async () => {
    const create = jest
      .spyOn(notifications, "createNotification")
      .mockResolvedValue({});

    await notifications.notifyAnnouncementCreated(
      "announcement-1",
      "workspace-1",
      "author-1",
      "Please read this"
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "recipient-1",
        data: expect.objectContaining({ announcementId: "announcement-1" }),
      })
    );
    create.mockRestore();
  });
});
