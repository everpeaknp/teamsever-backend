jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/LeaveRequest", () => ({ findOne: jest.fn(), find: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ findById: jest.fn() }));
jest.mock("../models/Conversation", () => ({ findById: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn().mockResolvedValue(false) }));
jest.mock("../services/enhancedNotificationService", () => ({
  default: { notifyLeaveApproved: jest.fn(), notifyLeaveDenied: jest.fn() },
}));
jest.mock("../services/socketService", () => ({ default: { getIO: jest.fn(() => null), emitToUsers: jest.fn() } }));

const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const DirectMessage = require("../models/DirectMessage");
const Conversation = require("../models/Conversation");
const socketService = require("../services/socketService").default;
const PermissionService = require("../permissions/permission.service");
const notifications = require("../services/enhancedNotificationService").default;
const LeaveService = require("../services/leaveService");

const queryFor = (doc: any) => {
  const query: any = {
    populate: jest.fn(() => query),
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    session: jest.fn(() => Promise.resolve(doc)),
    then: (resolve: any, reject: any) => Promise.resolve(doc).then(resolve, reject),
  };
  return query;
};

describe("leave and remote approval decisions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PermissionService.can.mockImplementation(async (_userId: string, permission: string) => permission === "MANAGE_LEAVES");
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "manager-1", name: "Manager" }) });
  });

  it("returns paginated requester history with an accurate total", async () => {
    const records = [{ _id: "request-11" }, { _id: "request-12" }];
    const query = queryFor(records);
    LeaveRequest.countDocuments.mockResolvedValue(12);
    LeaveRequest.find.mockReturnValue(query);

    const result = await LeaveService.getMyRequests("workspace-1", "user-1", 2, 10);

    expect(LeaveRequest.find).toHaveBeenCalledWith({ workspace: "workspace-1", requester: "user-1" });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      requests: records,
      pagination: { page: 2, pageSize: 10, total: 12, totalPages: 2, hasMore: false },
    });
  });

  it("paginates only the assigned manager's pending review inbox", async () => {
    const records = [{ _id: "pending-11" }];
    const query = queryFor(records);
    Workspace.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ owner: "owner-1" }) });
    LeaveRequest.countDocuments.mockResolvedValue(11);
    LeaveRequest.find.mockReturnValue(query);

    const result = await LeaveService.getReviewInbox("workspace-1", "manager-1", 2, 10);

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      workspace: "workspace-1",
      status: "pending",
      assignedManager: "manager-1",
    });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
      hasMore: false,
    });
  });

  it("filters workspace history by member, status, overlapping dates, and member or reason search", async () => {
    const records = [{ _id: "history-21" }];
    const query = queryFor(records);
    User.find.mockReturnValue(queryFor([{ _id: "member-1" }]));
    LeaveRequest.countDocuments.mockResolvedValue(21);
    LeaveRequest.find.mockReturnValue(query);

    const result = await LeaveService.getWorkspaceLeaves("workspace-1", {
      page: 2,
      pageSize: 10,
      status: "approved",
      userId: "507f1f77bcf86cd799439011",
      from: "2026-10-05",
      to: "2026-10-10",
      search: "Ramon",
    });

    const filter = LeaveRequest.find.mock.calls[0][0];
    expect(filter).toMatchObject({
      workspace: "workspace-1",
      status: "approved",
      requester: "507f1f77bcf86cd799439011",
    });
    expect(filter.startDate.$lte).toEqual(new Date("2026-10-10T23:59:59.999Z"));
    expect(filter.endDate.$gte).toEqual(new Date("2026-10-05T00:00:00.000Z"));
    expect(filter.$or).toHaveLength(2);
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result.pagination).toMatchObject({ page: 2, pageSize: 10, total: 21, totalPages: 3, hasMore: true });
  });

  it("approves a proposed remote request and activates its place only for the requested dates", async () => {
    const requesterId = "requester-1";
    const request = {
      _id: "leave-remote-1",
      workspace: "workspace-1",
      requester: requesterId,
      assignedManager: "manager-1",
      status: "pending",
      requestType: "remote",
      startDate: new Date("2026-10-05T00:00:00Z"),
      endDate: new Date("2026-10-06T00:00:00Z"),
      proposedRemoteArea: { name: "Home", latitude: 28.2, longitude: 83.98, radiusMeters: 60 },
      directMessageId: null,
      populate: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const member = { user: requesterId, privateRemoteAreas: [], temporaryRemoteApprovals: [] };
    const workspaceDoc = { owner: "owner-1", members: [member], markModified: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
    let workspaceReads = 0;
    Workspace.findById.mockImplementation(() => {
      workspaceReads += 1;
      if (workspaceReads === 1) return { select: jest.fn().mockResolvedValue({ owner: "owner-1" }) };
      if (workspaceReads === 2) {
        return { select: jest.fn(() => ({ session: jest.fn().mockResolvedValue(workspaceDoc) })) };
      }
      return Promise.resolve({ _id: "workspace-1", owner: "owner-1", members: [] });
    });
    LeaveRequest.findOne
      .mockReturnValueOnce(queryFor(request))
      .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(request) });
    const session = { withTransaction: jest.fn(async (callback: any) => callback()), endSession: jest.fn() };
    const startSession = jest.spyOn(mongoose, "startSession").mockResolvedValue(session);

    const result = await LeaveService.approveLeave(request._id, "manager-1", "workspace-1");

    expect(result.status).toBe("approved");
    expect(member.privateRemoteAreas).toHaveLength(1);
    expect(member.temporaryRemoteApprovals).toHaveLength(1);
    expect(member.temporaryRemoteApprovals[0]).toMatchObject({ startDate: request.startDate, endDate: request.endDate });
    expect(workspaceDoc.save).toHaveBeenCalled();
    expect(request.save).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
    startSession.mockRestore();
  });

  it("denies a pending leave request and records the optional denial reason", async () => {
    const request: any = {
      _id: "leave-1",
      workspace: "workspace-1",
      requester: "requester-1",
      assignedManager: "manager-1",
      status: "pending",
      requestType: "leave",
      directMessageId: null,
      populate: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    let workspaceReads = 0;
    Workspace.findById.mockImplementation(() => {
      workspaceReads += 1;
      return workspaceReads === 1
        ? { select: jest.fn().mockResolvedValue({ owner: "manager-1" }) }
        : Promise.resolve({ _id: "workspace-1", owner: "manager-1", members: [] });
    });
    LeaveRequest.findOne.mockReturnValue(queryFor(request));

    const result = await LeaveService.denyLeave(request._id, "manager-1", "workspace-1", "Coverage is unavailable");

    expect(result.status).toBe("denied");
    expect(result.denialReason).toBe("Coverage is unavailable");
    expect(result.deniedBy).toBe("manager-1");
    expect(request.save).toHaveBeenCalled();
    expect(notifications.notifyLeaveDenied).toHaveBeenCalled();
  });

  it("emits request decisions to both DM participants' personal sockets", async () => {
    const request: any = {
      _id: "leave-2",
      workspace: "workspace-1",
      requester: "requester-1",
      assignedManager: "manager-1",
      conversation: "conversation-1",
      directMessageId: "dm-1",
      status: "pending",
      requestType: "leave",
      populate: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const dm = {
      _id: "dm-1",
      conversation: "conversation-1",
      metadata: { status: "pending" },
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
      toObject: () => ({ _id: "dm-1", type: "leave_request", metadata: dm.metadata }),
    };
    DirectMessage.findById.mockResolvedValue(dm);
    Conversation.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ participants: ["manager-2", "requester-1"] }),
      }),
    });
    Workspace.findById.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue({ owner: "manager-1" }),
    })).mockResolvedValueOnce({ _id: "workspace-1", owner: "manager-1", members: [] });
    LeaveRequest.findOne.mockReturnValue(queryFor(request));

    await LeaveService.denyLeave(request._id, "manager-1", "workspace-1");

    expect(socketService.emitToUsers).toHaveBeenCalledWith(
      ["requester-1", "manager-1", "manager-2"],
      "dm:updated",
      expect.objectContaining({
        conversationId: "conversation-1",
        message: expect.objectContaining({ metadata: expect.objectContaining({ status: "denied" }) }),
      }),
    );
  });
});
