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

  it("allows only one shared office and rejects workspace-wide remote areas", async () => {
    const areas = [
      { name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 60, isActive: true },
      { name: "Branch", kind: "office", latitude: 41, longitude: -73, radiusMeters: 60, isActive: true }
    ];

    await expect(Service.updateLocationPolicy(workspaceId, ownerId, { enabled: false, areas })).rejects.toThrow("Only one office location");
    expect(workspace.save).not.toHaveBeenCalled();
  });

  it("rejects remote areas in the shared policy because they belong to a member", async () => {
    const areas = [
      { name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 150, isActive: true },
      { name: "Home", kind: "remote", latitude: 42, longitude: -72, radiusMeters: 150, isActive: true },
      { name: "Coworking", kind: "remote", latitude: 43, longitude: -71, radiusMeters: 150, isActive: true }
    ];

    await expect(Service.updateLocationPolicy(workspaceId, ownerId, { enabled: false, areas })).rejects.toThrow("remote areas are private");
  });

  it("treats clocked-out status as a valid workspace membership", () => {
    workspace.members[0].status = "inactive";
    expect(Service.assertActiveMember(workspace, memberId)).toBe(workspace.members[0]);
  });

  it("allows a member to switch to remote when they have private areas", async () => {
    workspace.members[0].privateRemoteAreas = [{ _id: remoteA, isActive: true }, { _id: remoteB, isActive: true }];
    workspace.attendanceLocationPolicy.enabled = true;
    await Service.assignMemberAttendanceLocations(workspaceId, ownerId, memberId, { attendanceMode: "remote", remoteAreaIds: [] });
    expect(workspace.members[0].attendanceMode).toBe("remote");
    expect(workspace.members[0].assignedRemoteLocationIds).toEqual([]);
    expect(workspace.save).toHaveBeenCalledTimes(1);
  });

  it("rejects office areas as remote assignment and rejects unknown members", async () => {
    workspace.attendanceLocationPolicy.areas = [{ _id: remoteA, kind: "office", isActive: true }];
    await expect(Service.assignMemberAttendanceLocations(workspaceId, ownerId, memberId, { attendanceMode: "remote", remoteAreaIds: [remoteA] })).rejects.toThrow("private to each member");
    await expect(Service.assignMemberAttendanceLocations(workspaceId, ownerId, new mongoose.Types.ObjectId().toString(), { attendanceMode: "onsite", remoteAreaIds: [] })).rejects.toThrow("member not found");
  });

  it("keeps coordinates out of policy audit metadata", async () => {
    await Service.updateLocationPolicy(workspaceId, ownerId, { enabled: false, areas: [{ name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 150, isActive: true }] });
    const activity = WorkspaceActivity.createActivity.mock.calls[0][0];
    expect(activity.metadata).toMatchObject({ action: "attendance_location_policy_updated", enabled: false });
    expect(JSON.stringify(activity.metadata)).not.toContain("latitude");
    expect(JSON.stringify(activity.metadata)).not.toContain("longitude");
  });

  it("stores an optional public IP on the single shared office", async () => {
    await Service.updateLocationPolicy(workspaceId, ownerId, {
      enabled: true,
      areas: [{ name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" }]
    });
    expect(workspace.attendanceLocationPolicy.areas[0]).toMatchObject({ kind: "office", networkIp: "203.0.113.10", radiusMeters: 60 });
  });

  it("rejects an invalid optional office IP", async () => {
    await expect(Service.updateLocationPolicy(workspaceId, ownerId, {
      enabled: true,
      areas: [{ name: "HQ", kind: "office", latitude: 40, longitude: -74, radiusMeters: 60, isActive: true, networkIp: "not-an-ip" }]
    })).rejects.toThrow("Invalid office network IP address");
  });

  it("stores private remote areas on the selected member, not in the shared office policy", async () => {
    const result = await Service.updateMemberRemoteAreas(workspaceId, ownerId, memberId, {
      areas: [{ name: "Home", latitude: 27.7172, longitude: 85.324, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" }]
    });
    expect(result.privateRemoteAreas).toHaveLength(1);
    expect(workspace.attendanceLocationPolicy.areas).toEqual([]);
    expect(workspace.members[0].privateRemoteAreas[0]).toMatchObject({ name: "Home", latitude: 27.7172, networkIp: "203.0.113.10" });
  });

  it("accepts optional network confirmation only for a member's remote place when GPS is imprecise", async () => {
    const area = { _id: remoteA, name: "Home", latitude: 27.7172, longitude: 85.324, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" };
    workspace.attendanceLocationPolicy = { enabled: true, maxAccuracyMeters: 100, areas: [] };
    workspace.members[0].attendanceMode = "remote";
    workspace.members[0].privateRemoteAreas = [area];
    const fix = { latitude: 27.7172, longitude: 85.324, accuracyMeters: 200, capturedAt: new Date().toISOString() };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], fix, new Date(), "203.0.113.10"))
      .resolves.toMatchObject({ areaId: remoteA, verificationMethod: "network_confirmed", mode: "remote" });
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], fix, new Date(), "198.51.100.2"))
      .rejects.toThrow("IP seen by the server does not match");
  });

  it("allows office-network confirmation only when the GPS uncertainty overlaps the fixed office geofence", async () => {
    const office = { _id: remoteA, kind: "office", name: "HQ", latitude: 40, longitude: -74, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" };
    workspace.attendanceLocationPolicy = { enabled: true, maxAccuracyMeters: 100, areas: [office] };
    const capturedAt = new Date().toISOString();
    const nearButOutside = { latitude: 40.0006, longitude: -74, accuracyMeters: 20, capturedAt };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], nearButOutside, new Date(), "203.0.113.10"))
      .resolves.toMatchObject({ areaId: remoteA, verificationMethod: "network_confirmed", mode: "onsite" });
    const farAway = { ...nearButOutside, latitude: 40.002 };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], farAway, new Date(), "203.0.113.10"))
      .rejects.toThrow("uncertainty circle does not overlap");
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], nearButOutside, new Date(), "198.51.100.2"))
      .rejects.toThrow("does not match");
  });

  it("allows a matching private remote IP only when the imprecise GPS uncertainty circle overlaps the geofence", async () => {
    const area = { _id: remoteA, name: "Home", latitude: 27.7172, longitude: 85.324, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" };
    workspace.attendanceLocationPolicy = { enabled: true, maxAccuracyMeters: 100, areas: [] };
    workspace.members[0].attendanceMode = "remote";
    workspace.members[0].privateRemoteAreas = [area];
    const fix = { latitude: 27.718, longitude: 85.324, accuracyMeters: 200, capturedAt: new Date().toISOString() };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], fix, new Date(), "203.0.113.10"))
      .resolves.toMatchObject({ areaId: remoteA, verificationMethod: "network_confirmed", mode: "remote" });
    const farFix = { ...fix, latitude: 27.73 };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], farFix, new Date(), "203.0.113.10"))
      .rejects.toThrow("GPS uncertainty circle does not overlap");
    const tooImprecise = { ...fix, accuracyMeters: 251 };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], tooImprecise, new Date(), "203.0.113.10"))
      .rejects.toThrow("uncertainty must be 250 m or better");
  });

  it("never lets a registered IP authorize an accurate GPS reading outside the remote place", async () => {
    const area = { _id: remoteA, name: "Home", latitude: 27.7172, longitude: 85.324, radiusMeters: 60, isActive: true, networkIp: "203.0.113.10" };
    workspace.attendanceLocationPolicy = { enabled: true, maxAccuracyMeters: 100, areas: [] };
    workspace.members[0].attendanceMode = "remote";
    workspace.members[0].privateRemoteAreas = [area];
    const fix = { latitude: 28, longitude: 84, accuracyMeters: 10, capturedAt: new Date().toISOString() };
    await expect(Service.validateClockInLocation(workspace, workspace.members[0], fix, new Date(), "203.0.113.10"))
      .rejects.toThrow("uncertainty circle does not overlap");
  });

  it("rejects invalid optional remote-area IP addresses", async () => {
    await expect(Service.updateMemberRemoteAreas(workspaceId, ownerId, memberId, {
      areas: [{ name: "Home", latitude: 27.7172, longitude: 85.324, radiusMeters: 60, isActive: true, networkIp: "not-an-ip" }]
    })).rejects.toThrow("public IP address");
  });

  it("does not allow a member's private remote location to authorize another member", () => {
    workspace.members[0].privateRemoteAreas = [{ _id: remoteA, kind: "remote", name: "Home", latitude: 42, longitude: -72, radiusMeters: 60, isActive: true }];
    workspace.members.push({ user: ownerId, role: "owner", attendanceMode: "remote", privateRemoteAreas: [] });
    expect(Service.eligibleAreasForMember(workspace, workspace.members[1])).toEqual([]);
  });

  it("authorizes an on-site member's private area only during the approved remote dates", () => {
    const area = { _id: remoteA, name: "Home", latitude: 42, longitude: -72, radiusMeters: 60, isActive: true };
    workspace.attendanceLocationPolicy.areas = [{ _id: remoteB, kind: "office", name: "HQ", latitude: 40, longitude: -74, radiusMeters: 60, isActive: true }];
    workspace.members[0].privateRemoteAreas = [area];
    workspace.members[0].temporaryRemoteApprovals = [{ areaId: remoteA, startDate: new Date("2026-09-27T00:00:00Z"), endDate: new Date("2026-09-29T00:00:00Z"), requestId: new mongoose.Types.ObjectId() }];
    expect(Service.eligibleAreasForMember(workspace, workspace.members[0], new Date("2026-09-28T12:00:00Z")).map((item: any) => item.name)).toEqual(["HQ", "Home"]);
    expect(Service.eligibleAreasForMember(workspace, workspace.members[0], new Date("2026-09-30T00:00:00Z")).map((item: any) => item.name)).toEqual(["HQ"]);
  });

  it("compares clock-out with the saved clock-in point using the 60 meter rule", () => {
    const start = { latitude: 27.7172, longitude: 85.324 };
    const capturedAt = new Date().toISOString();
    expect(Service.validateClockOutLocation({ latitude: 27.7173, longitude: 85.324, accuracyMeters: 10, capturedAt }, start).withinRange).toBe(true);
    expect(Service.validateClockOutLocation({ latitude: 27.717741, longitude: 85.324, accuracyMeters: 10, capturedAt }, start).withinRange).toBe(false);
    expect(Service.validateClockOutLocation({ latitude: 27.72, longitude: 85.324, accuracyMeters: 10, capturedAt }, start).withinRange).toBe(false);
    expect(Service.validateClockOutLocation({ latitude: 27.7173, longitude: 85.324, accuracyMeters: 150, capturedAt }, start).reason).toBe("Clock-out location accuracy is too low");
    expect(Service.validateClockOutLocation(null, start).withinRange).toBe(false);
  });
});
