jest.mock("../models/Workspace", () => ({ findById: jest.fn(), findOne: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ timezone: "UTC" }) }) }) }));
jest.mock("../models/LeaveRequest", () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ findById: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn().mockResolvedValue(false) }));
jest.mock("../services/enhancedNotificationService", () => ({
  default: { notifyLeaveApproved: jest.fn(), notifyLeaveDenied: jest.fn() },
}));
jest.mock("../services/socketService", () => ({ default: { getIO: jest.fn(() => null) } }));

const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const PermissionService = require("../permissions/permission.service");
const notifications = require("../services/enhancedNotificationService").default;
const LeaveService = require("../services/leaveService");

const queryFor = (doc: any) => {
  const query: any = {
    populate: jest.fn(() => query),
    select: jest.fn(() => query),
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
      toObject: jest.fn(() => ({ ...request })),
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
    expect(request.save).toHaveBeenCalledWith({ session });
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
      startDate: new Date("2026-10-05T00:00:00Z"),
      endDate: new Date("2026-10-05T00:00:00Z"),
      directMessageId: null,
      populate: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn(() => ({ ...request })),
    };
    let workspaceReads = 0;
    Workspace.findById.mockImplementation(() => {
      workspaceReads += 1;
      return workspaceReads === 1
        ? { select: jest.fn().mockResolvedValue({ owner: "manager-1" }) }
        : Promise.resolve({ _id: "workspace-1", owner: "manager-1", members: [] });
    });
    LeaveRequest.findOne.mockReturnValue(queryFor(request));
    LeaveRequest.findOneAndUpdate.mockImplementation(async (_filter: any, update: any) => {
      Object.assign(request, update.$set);
      return request;
    });

    const result = await LeaveService.denyLeave(request._id, "manager-1", "workspace-1", "Coverage is unavailable");

    expect(result.status).toBe("denied");
    expect(result.denialReason).toBe("Coverage is unavailable");
    expect(result.deniedBy).toBe("manager-1");
    expect(LeaveRequest.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: request._id, workspace: "workspace-1", status: "pending", endDate: { $gte: expect.any(Date) } }),
      expect.objectContaining({ $set: expect.objectContaining({ status: "denied", denialReason: "Coverage is unavailable" }) }),
      { new: true }
    );
    expect(notifications.notifyLeaveDenied).toHaveBeenCalled();
  });

  it.each([
    ["approved", "approve"],
    ["denied", "deny"],
    ["expired", "approve"],
  ])("returns a conflict when a %s request receives another %s decision", async (status, action) => {
    const request = {
      _id: "terminal-leave-1",
      workspace: "workspace-1",
      requester: "requester-1",
      assignedManager: "manager-1",
      status,
      requestType: "leave",
      startDate: new Date("2026-10-05T00:00:00Z"),
      endDate: new Date("2026-10-05T00:00:00Z"),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    Workspace.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ owner: "manager-1" }) });
    LeaveRequest.findOne.mockReturnValue(queryFor(request));

    const decide = action === "approve"
      ? LeaveService.approveLeave(request._id, "manager-1", "workspace-1")
      : LeaveService.denyLeave(request._id, "manager-1", "workspace-1");

    await expect(decide).rejects.toMatchObject({ statusCode: 409 });
  });
});
