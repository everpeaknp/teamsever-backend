jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../models/WorkspaceActivity", () => ({ createActivity: jest.fn().mockResolvedValue({}) }));

const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const Service = require("../services/attendanceLocationService");
const workspaceId = new mongoose.Types.ObjectId().toString();
const ownerId = new mongoose.Types.ObjectId().toString();
const memberId = new mongoose.Types.ObjectId().toString();
const remoteA = new mongoose.Types.ObjectId().toString();
const remoteB = new mongoose.Types.ObjectId().toString();

describe("attendance location policy storage and workspace scoping", () => {
  let workspace: any;
  beforeEach(() => {
    jest.clearAllMocks();
    workspace = {
      _id: workspaceId,
      owner: ownerId,
      members: [{ user: memberId, role: "member", status: "active", attendanceMode: "onsite", assignedRemoteLocationIds: [] }],
      attendanceLocationPolicy: { enabled: false, maxAccuracyMeters: 100, areas: [] },
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn()
    };
    Workspace.findOne.mockResolvedValue(workspace);
  });

  it("requires an active office area before enabling enforcement", async () => {
    await expect(Service.updateLocationPolicy(workspaceId, ownerId, { enabled: true, areas: [] })).rejects.toThrow("active office area");
    expect(workspace.save).not.toHaveBeenCalled();
  });

  it("treats clocked-out status as a valid workspace membership", () => {
    workspace.members[0].status = "inactive";
    expect(Service.assertActiveMember(workspace, memberId)).toBe(workspace.members[0]);
  });

  it("allows remote members to receive multiple active remote areas", async () => {
    workspace.attendanceLocationPolicy.areas = [
      { _id: remoteA, kind: "remote", isActive: true },
      { _id: remoteB, kind: "remote", isActive: true }
    ];
    await Service.assignMemberAttendanceLocations(workspaceId, ownerId, memberId, { attendanceMode: "remote", remoteAreaIds: [remoteA, remoteB] });
    expect(workspace.members[0].attendanceMode).toBe("remote");
    expect(workspace.members[0].assignedRemoteLocationIds.map(String)).toEqual([remoteA, remoteB]);
    expect(workspace.save).toHaveBeenCalledTimes(1);
  });

  it("rejects office areas as remote assignment and rejects unknown members", async () => {
    workspace.attendanceLocationPolicy.areas = [{ _id: remoteA, kind: "office", isActive: true }];
    await expect(Service.assignMemberAttendanceLocations(workspaceId, ownerId, memberId, { attendanceMode: "remote", remoteAreaIds: [remoteA] })).rejects.toThrow("active remote areas");
    await expect(Service.assignMemberAttendanceLocations(workspaceId, ownerId, new mongoose.Types.ObjectId().toString(), { attendanceMode: "onsite", remoteAreaIds: [] })).rejects.toThrow("member not found");
  });

  it("keeps coordinates out of policy audit metadata", async () => {
    await Service.updateLocationPolicy(workspaceId, ownerId, { enabled: false, areas: [{ name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 150, isActive: true }] });
    const activity = WorkspaceActivity.createActivity.mock.calls[0][0];
    expect(activity.metadata).toMatchObject({ action: "attendance_location_policy_updated", enabled: false });
    expect(JSON.stringify(activity.metadata)).not.toContain("latitude");
    expect(JSON.stringify(activity.metadata)).not.toContain("longitude");
  });
});
