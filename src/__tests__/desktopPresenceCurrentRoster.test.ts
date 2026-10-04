const express = require("express");
const request = require("supertest");

const workspaceId = "64b000000000000000000001";
const ownerId = "64b000000000000000000002";
const viewerId = "64b000000000000000000003";
const otherId = "64b000000000000000000005";
const thirdId = "64b000000000000000000006";
const deviceId = "64b000000000000000000007";
let mockMembers: any[];
let mockOwner: string;
let mockUsers: any[];
let mockRunningEntries: any[];
let mockDevices: any[];
let mockReports: any[];
let mockCanManage: boolean;

jest.mock("../middlewares/authMiddleware", () => ({ protect: (req: any, _res: any, next: any) => { req.user = { id: viewerId }; next(); } }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn(async () => mockCanManage) }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn(() => ({ select: async () => ({ owner: mockOwner, members: mockMembers }) })) }));
jest.mock("../models/User", () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => mockUsers }) })) }));
jest.mock("../models/TimeEntry", () => ({
  find: jest.fn(() => ({ select: () => ({ lean: async () => mockRunningEntries }) })),
  exists: jest.fn(async () => false),
}));
jest.mock("../models/TrustedAttendanceDevice", () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => mockDevices }) })) }));
jest.mock("../models/DesktopAppPresence", () => ({ aggregate: jest.fn(async () => mockReports) }));
jest.mock("../models/DesktopTrackingGap", () => ({}));

const router = require("../routes/attendanceLocationRoutes");
const app = express();
app.use("/api/attendance", router);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

function setupRoster() {
  mockOwner = ownerId;
  mockMembers = [{ user: viewerId, status: "active" }, { user: otherId, status: "active" }, { user: thirdId, status: "active" }];
  mockUsers = [
    { _id: viewerId, name: "Ramon", profilePicture: "ramon.png" },
    { _id: otherId, name: "Ada", profilePicture: null },
    { _id: thirdId, name: "Bea", profilePicture: null },
    { _id: ownerId, name: "Owner", profilePicture: null },
  ];
  mockRunningEntries = [{
    _id: "64b000000000000000000008",
    user: otherId,
    startTime: new Date(Date.now() - 30 * 60_000),
    clockInSource: "desktop",
    clockInDevice: deviceId,
  }];
  mockDevices = [{ _id: deviceId, user: otherId, activityMonitoringEnabled: true, activityMonitoringEnabledAt: new Date(Date.now() - 60 * 60_000), revokedAt: null }];
  mockReports = [{
    _id: "64b000000000000000000009",
    timeEntry: "64b000000000000000000008",
    device: deviceId,
    appId: "brave.exe",
    presenceStatus: "active",
    endedAt: new Date(Date.now() - 30_000),
  }];
  mockCanManage = false;
}

beforeEach(setupRoster);

describe("workspace current desktop presence roster", () => {
  it("allows an ordinary member to read a person-by-person compact current presence", async () => {
    const response = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=4`);

    expect(response.status).toBe(200);
    expect(response.body.data.members.map((member: any) => member.displayName)).toEqual(["Ada", "Bea", "Owner", "Ramon"]);
    expect(response.body.data.members[0].presence).toEqual(expect.objectContaining({ appId: "brave.exe", presenceStatus: "active" }));
    expect(response.body.data.members[1].presence).toBeNull();
    expect(response.body.data.members[0]).toEqual(expect.objectContaining({ userId: otherId, avatar: null }));
    expect(response.body.data.members[0]).not.toHaveProperty("history");
    expect(response.body.data.permissions.canViewHistory).toBe(false);
  });

  it("paginates members by stable normalized name and user id", async () => {
    const firstPage = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=2`);
    const cursor = firstPage.body.data.pagination.nextCursor;
    const secondPage = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=2&cursor=${encodeURIComponent(cursor)}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.members.map((member: any) => member.displayName)).toEqual(["Ada", "Bea"]);
    expect(firstPage.body.data.pagination.hasMore).toBe(true);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.members.map((member: any) => member.displayName)).toEqual(["Owner", "Ramon"]);
    expect(secondPage.body.data.pagination.hasMore).toBe(false);
  });

  it("does not expose current presence to a user outside the active workspace", async () => {
    mockMembers = [{ user: otherId, status: "active" }];
    mockOwner = ownerId;
    mockRunningEntries = [];

    const response = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current`);

    expect(response.status).toBe(403);
  });
});


describe("current roster privacy boundaries", () => {
  it("uses the same not-reporting result for a stale heartbeat and disabled consent", async () => {
    mockReports = [{
      _id: "64b000000000000000000009",
      timeEntry: "64b000000000000000000008",
      device: deviceId,
      appId: "brave.exe",
      presenceStatus: "active",
      endedAt: new Date(Date.now() - 91_000),
    }];
    const staleResponse = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=4`);
    const stalePresence = staleResponse.body.data.members.find((member: any) => member.userId === otherId).presence;

    mockDevices = [];
    const consentResponse = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=4`);
    const consentPresence = consentResponse.body.data.members.find((member: any) => member.userId === otherId).presence;

    expect(stalePresence).toBeNull();
    expect(consentPresence).toBeNull();
  });

  it("returns the history-access hint only for viewers with an existing attendance permission", async () => {
    mockCanManage = true;
    const response = await request(app).get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=4`);

    expect(response.status).toBe(200);
    expect(response.body.data.permissions.canViewHistory).toBe(true);
  });
});
