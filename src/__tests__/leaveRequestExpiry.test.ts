jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../models/LeaveRequest", () => ({ find: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ findById: jest.fn() }));
jest.mock("../models/Conversation", () => ({ findById: jest.fn() }));
jest.mock("../models/User", () => ({}));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn() }));
jest.mock("../services/workspaceCalendar", () => ({
  getWorkspaceTimezone: jest.fn().mockResolvedValue("Asia/Kathmandu"),
  workspaceCalendarDateKey: jest.fn().mockReturnValue("2026-10-12"),
}));
jest.mock("../services/enhancedNotificationService", () => ({ default: {} }));
jest.mock("../services/socketService", () => ({ default: { emitToUsers: jest.fn() } }));

const LeaveRequest = require("../models/LeaveRequest");
const DirectMessage = require("../models/DirectMessage");
const Conversation = require("../models/Conversation");
const socketService = require("../services/socketService").default;
const leaveService = require("../services/leaveService");

describe("leave request expiry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("expires past pending requests and updates their linked DM card", async () => {
    const request = {
      _id: "request-1",
      workspace: "workspace-1",
      requester: "requester-1",
      assignedManager: "manager-1",
      conversation: "conversation-1",
      directMessageId: "message-1",
    };
    const dm = {
      metadata: { status: "pending" },
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    const conversationQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ participants: ["requester-1", "manager-1"] }),
    };

    LeaveRequest.find.mockResolvedValue([request]);
    LeaveRequest.findOneAndUpdate.mockResolvedValue(request);
    DirectMessage.findById.mockResolvedValue(dm);
    Conversation.findById.mockReturnValue(conversationQuery);

    const expiredCount = await leaveService.expireWorkspaceRequests(
      "workspace-1",
      new Date("2026-10-12T06:00:00.000Z"),
    );

    expect(expiredCount).toBe(1);
    expect(LeaveRequest.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: "request-1",
        status: "pending",
        endDate: { $lt: new Date("2026-10-13T00:00:00.000Z") },
      },
      { $set: { status: "expired", expiredAt: new Date("2026-10-12T06:00:00.000Z") } },
      { new: true },
    );
    expect(dm.metadata).toMatchObject({ status: "expired", expiredAt: new Date("2026-10-12T06:00:00.000Z") });
    expect(dm.save).toHaveBeenCalledTimes(1);
    expect(socketService.emitToUsers).toHaveBeenCalledWith(
      ["requester-1", "manager-1"],
      "dm:updated",
      expect.objectContaining({
        conversationId: "conversation-1",
        message: expect.objectContaining({
          conversation: "conversation-1",
          metadata: expect.objectContaining({ status: "expired" }),
        }),
      }),
    );
  });

  it("does not update a DM if another reviewer already resolved the request", async () => {
    LeaveRequest.find.mockResolvedValue([{ _id: "request-1" }]);
    LeaveRequest.findOneAndUpdate.mockResolvedValue(null);

    await expect(leaveService.expireWorkspaceRequests("workspace-1", new Date("2026-10-12T06:00:00.000Z"))).resolves.toBe(0);
    expect(DirectMessage.findById).not.toHaveBeenCalled();
  });
});
