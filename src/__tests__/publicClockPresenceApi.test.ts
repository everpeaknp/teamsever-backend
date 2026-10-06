const express = require("express");
const request = require("supertest");

const workspaceId = "64b000000000000000000001";
const targetUserId = "64b000000000000000000003";
const viewerId = "64b000000000000000000006";
const timeEntryId = "64b000000000000000000002";
const deviceId = "64b000000000000000000004";

jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = { id: viewerId };
    next();
  },
}));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/TimeEntry", () => ({ findOne: jest.fn() }));
jest.mock("../models/TrustedAttendanceDevice", () => ({ findOne: jest.fn() }));
jest.mock("../models/DesktopAppPresence", () => ({ findOne: jest.fn() }));
jest.mock("../models/DesktopTrackingGap", () => ({ updateOne: jest.fn() }));

const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const TrustedAttendanceDevice = require("../models/TrustedAttendanceDevice");
const DesktopAppPresence = require("../models/DesktopAppPresence");
const router = require("../routes/attendanceLocationRoutes");

const workspace = {
  owner: "64b000000000000000000007",
  members: [
    { user: viewerId, status: "active" },
    { user: targetUserId, status: "active" },
  ],
};
const entry = {
  _id: timeEntryId,
  user: targetUserId,
  startTime: new Date(Date.now() - 60 * 60_000),
  isRunning: true,
  clockInSource: "desktop",
  clockInDevice: deviceId,
};

const chainResult = (value: any) => ({
  select() { return this; },
  sort() { return this; },
  lean: async () => value,
  then(resolve: any, reject: any) { return Promise.resolve(value).then(resolve, reject); },
});

let app: any;
beforeEach(() => {
  jest.clearAllMocks();
  Workspace.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(workspace) });
  TimeEntry.findOne.mockReturnValue(chainResult(entry));
  TrustedAttendanceDevice.findOne.mockReturnValue(chainResult({ activityMonitoringEnabledAt: new Date(Date.now() - 3_600_000) }));
  DesktopAppPresence.findOne.mockReturnValue(chainResult({
    appId: "code.exe",
    presenceStatus: "active",
    startedAt: new Date(Date.now() - 4 * 60_000),
    endedAt: new Date(Date.now() - 5_000),
  }));
  app = express();
  app.use(express.json());
  app.use("/api/attendance", router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));
});

describe("workspace-visible profile clock presence", () => {
  const url = `/api/attendance/workspace/${workspaceId}/members/${targetUserId}/public-presence`;

  it("returns the live shift and current app interval but no activity history", async () => {
    const response = await request(app).get(url);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      clockedIn: true,
      clockedInAt: entry.startTime.toISOString(),
      foregroundApp: {
        appId: "code.exe",
        presenceStatus: "active",
        startedAt: expect.any(String),
      },
    });
    expect(JSON.stringify(response.body.data)).not.toMatch(/events|gaps|location|timeline/i);
  });

  it("reports the shift without an app when the desktop report is stale", async () => {
    DesktopAppPresence.findOne.mockReturnValueOnce(chainResult(null));

    const response = await request(app).get(url);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ clockedIn: true, foregroundApp: null });
  });

  it("does not resurrect an older app report after a newer unavailable heartbeat", async () => {
    DesktopAppPresence.findOne.mockReturnValueOnce(chainResult({
      appId: "code.exe",
      presenceStatus: "unavailable",
      startedAt: new Date(Date.now() - 30_000),
      endedAt: new Date(Date.now() - 5_000),
    }));

    const response = await request(app).get(url);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ clockedIn: true, foregroundApp: null });
    expect(DesktopAppPresence.findOne.mock.calls[0][0].presenceStatus).toBeUndefined();
  });

  it("denies viewers who are not active workspace members", async () => {
    Workspace.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ owner: workspace.owner, members: [] }) });

    const response = await request(app).get(url);

    expect(response.status).toBe(403);
    expect(TimeEntry.findOne).not.toHaveBeenCalled();
  });

  it("does not return presence for a target outside the workspace", async () => {
    Workspace.findById.mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ owner: workspace.owner, members: [{ user: viewerId, status: "active" }] }) });

    const response = await request(app).get(url);

    expect(response.status).toBe(404);
    expect(TimeEntry.findOne).not.toHaveBeenCalled();
  });
});
