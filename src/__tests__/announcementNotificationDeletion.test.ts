jest.mock("../models/Announcement", () => ({
  findOneAndDelete: jest.fn(),
}));
jest.mock("../models/Workspace", () => ({}));
jest.mock("../services/enhancedNotificationService", () => ({
  notifyAnnouncementCreated: jest.fn(),
}));
jest.mock("../services/notificationService", () => ({
  deleteAnnouncementNotifications: jest.fn(),
}));
jest.mock("../permissions/permission.service", () => ({
  can: jest.fn(),
}));
jest.mock("../services/analyticsV2CacheService", () => ({
  invalidateWorkspace: jest.fn().mockResolvedValue(undefined),
}));

const Announcement = require("../models/Announcement");
const notificationService = require("../services/notificationService");
const PermissionService = require("../permissions/permission.service");
const announcementController = require("../controllers/announcementController");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("announcement deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PermissionService.can.mockResolvedValue(true);
  });

  it("removes all recipient notifications for the deleted announcement", async () => {
    Announcement.findOneAndDelete.mockResolvedValue({
      _id: { toString: () => "announcement-1" },
    });
    notificationService.deleteAnnouncementNotifications.mockResolvedValue(undefined);
    const req: any = {
      params: { id: "workspace-1", announcementId: "announcement-1" },
      user: { id: "admin-1" },
    };
    const res = createRes();

    await announcementController.deleteAnnouncement(req, res);

    expect(notificationService.deleteAnnouncementNotifications).toHaveBeenCalledWith(
      "announcement-1"
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
