const express = require("express");
const request = require("supertest");

const workspaceId = "64b000000000000000000001";
const viewerId = "64b000000000000000000006";
const memberId = "64b000000000000000000003";
const entryId = "64b000000000000000000002";
const deviceId = "64b000000000000000000004";

jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = { id: viewerId };
    next();
  },
}));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/TimeEntry", () => ({ find: jest.fn() }));
jest.mock("../models/TrustedAttendanceDevice", () => ({ find: jest.fn() }));
jest.mock("../models/DesktopAppPresence", () => ({ find: jest.fn(), aggregate: jest.fn() }));
jest.mock("../models/DesktopTrackingGap", () => ({ updateOne: jest.fn() }));
jest.mock("../models/User", () => ({ find: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn(async () => false) }));

const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const TrustedAttendanceDevice = require("../models/TrustedAttendanceDevice");
const DesktopAppPresence = require("../models/DesktopAppPresence");
const User = require("../models/User");
const router = require("../routes/attendanceLocationRoutes");

const chain = (value: any) => ({
  select() { return this; },
  populate() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean: async () => value,
  then(resolve: any, reject: any) { return Promise.resolve(value).then(resolve, reject); },
});

let app: any;
beforeEach(() => {
  jest.clearAllMocks();
  Workspace.findById.mockReturnValue(chain({
    owner: "64b000000000000000000007",
    members: [{ user: viewerId, status: "active" }],
  }));
  User.find.mockReturnValue(chain([
    { _id: viewerId, name: "Ramon", profilePicture: "avatar.png" },
    { _id: "64b000000000000000000007", name: "Owner", profilePicture: null },
  ]));
  TimeEntry.find.mockReturnValue(chain([{
    _id: entryId,
    user: { _id: viewerId, name: "Ramon", profilePicture: "avatar.png" },
    startTime: new Date(Date.now() - 60_000),
    clockInSource: "desktop",
    clockInDevice: deviceId,
  }]));
  TrustedAttendanceDevice.find.mockReturnValue(chain([{
    _id: deviceId,
    user: viewerId,
    activityMonitoringEnabled: true,
    activityMonitoringEnabledAt: new Date(Date.now() - 3_600_000),
  }]));
  DesktopAppPresence.find.mockReturnValue(chain([{
    timeEntry: entryId,
    device: deviceId,
    appId: "code.exe",
    presenceStatus: "active",
    endedAt: new Date(Date.now() - 5_000),
  }]));
  DesktopAppPresence.aggregate.mockResolvedValue([{
    timeEntry: entryId,
    device: deviceId,
    appId: "code.exe",
    presenceStatus: "active",
    endedAt: new Date(Date.now() - 5_000),
  }]);
  app = express();
  app.use("/api/attendance", router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));
});

describe("current desktop presence API", () => {
  it("returns a paginated live roster to an active workspace member without history access", async () => {
    const response = await request(app)
      .get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?pageSize=25`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      members: [
        { userId: "64b000000000000000000007", displayName: "Owner", avatar: null, presence: null },
        {
          userId: viewerId,
          displayName: "Ramon",
          avatar: "avatar.png",
          presence: { appId: "code.exe", presenceStatus: "active" },
        },
      ],
      pagination: { pageSize: 25, hasMore: false },
      permissions: { canViewHistory: false },
    });
  });

  it("rejects a viewer who is not an active workspace member", async () => {
    Workspace.findById.mockReturnValueOnce(chain({ owner: "64b000000000000000000007", members: [] }));

    const response = await request(app)
      .get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current`);

    expect(response.status).toBe(403);
    expect(TimeEntry.find).not.toHaveBeenCalled();
  });

  it("rejects malformed cursors without querying attendance data", async () => {
    const response = await request(app)
      .get(`/api/attendance/workspace/${workspaceId}/desktop-presence/current?cursor=not-a-cursor`);

    expect(response.status).toBe(400);
    expect(TimeEntry.find).not.toHaveBeenCalled();
  });
});
