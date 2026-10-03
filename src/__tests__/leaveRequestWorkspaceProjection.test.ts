jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/LeaveRequest", () => ({ find: jest.fn(), create: jest.fn() }));
jest.mock("../models/Conversation", () => ({ findOne: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("../models/DirectMessage", () => ({ create: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn() }));

const Workspace = require("../models/Workspace");
const LeaveRequest = require("../models/LeaveRequest");
const Conversation = require("../models/Conversation");
const DirectMessage = require("../models/DirectMessage");
const PermissionService = require("../permissions/permission.service");
const LeaveService = require("../services/leaveService");

describe("leave request workspace projection", () => {
  it("selects private addresses without projecting both members and a nested member path", async () => {
    const requesterId = "requester-1";
    const managerId = "manager-1";
    const select = jest.fn().mockResolvedValue({
      owner: managerId,
      members: [
        { user: requesterId, status: "active", attendanceMode: "onsite", privateRemoteAreas: [] },
        { user: managerId, status: "active" },
      ],
    });
    Workspace.findById.mockReturnValue({ select });
    PermissionService.can.mockResolvedValue(true);
    LeaveRequest.find.mockResolvedValue([]);
    LeaveRequest.create.mockResolvedValue({ populate: jest.fn().mockResolvedValue(undefined) });

    await LeaveService.requestLeave({
      workspaceId: "workspace-1",
      requesterId,
      assignedManagerId: managerId,
      startDate: "2026-10-03",
      endDate: "2026-10-03",
      reason: "Appointment",
      requestType: "leave",
    });

    expect(select).toHaveBeenCalledWith("+members.privateRemoteAreas");
  });

  it("lets the assigned leave approver receive a proposed remote place request", async () => {
    const requesterId = "requester-2";
    const managerId = "manager-2";
    Workspace.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        owner: "workspace-owner",
        members: [
          { user: requesterId, status: "active", attendanceMode: "onsite", privateRemoteAreas: [] },
          { user: managerId, status: "active" },
        ],
      }),
    });
    PermissionService.can.mockImplementation(async (_userId, permission) => permission === "MANAGE_LEAVES");
    Conversation.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ participants: [requesterId, managerId] }),
    });
    LeaveRequest.find.mockResolvedValue([]);
    const leave = {
      _id: "leave-2",
      remoteAreaId: null,
      remoteAreaName: "Home",
      proposedRemoteArea: { name: "Home", latitude: 28.2, longitude: 83.98, radiusMeters: 60 },
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
    };
    LeaveRequest.create.mockResolvedValue(leave);
    DirectMessage.create.mockResolvedValue({ _id: "dm-2", populate: jest.fn().mockResolvedValue(undefined) });
    Conversation.findByIdAndUpdate.mockResolvedValue({});

    await expect(LeaveService.requestLeave({
      workspaceId: "workspace-2",
      requesterId,
      assignedManagerId: managerId,
      conversationId: "conversation-2",
      startDate: "2026-10-03",
      endDate: "2026-10-03",
      reason: "Working from home",
      requestType: "remote",
      proposedRemoteArea: { name: "Home", latitude: 28.2, longitude: 83.98, radiusMeters: 60 },
    })).resolves.toBe(leave);
  });
});
