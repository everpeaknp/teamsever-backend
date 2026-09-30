const express = require("express");
const request = require("supertest");

const mockWorkspaceId = "64b000000000000000000001";
const mockTimeEntryId = "64b000000000000000000002";
const mockUserId = "64b000000000000000000003";
const mockDeviceId = "64b000000000000000000004";

jest.mock("../middlewares/authMiddleware", () => ({ protect: (_req: any, _res: any, next: any) => next() }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({
  desktopDeviceAuth: (req: any, _res: any, next: any) => {
    req.user = { id: mockUserId };
    req.desktopDevice = { _id: mockDeviceId, activityMonitoringEnabled: req.header("x-consent") !== "off" };
    next();
  },
}));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../models/TimeEntry", () => ({ findOne: jest.fn() }));
jest.mock("../models/DesktopAppPresence", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../models/DesktopTrackingGap", () => ({ updateOne: jest.fn() }));

const TimeEntry = require("../models/TimeEntry");
const DesktopAppPresence = require("../models/DesktopAppPresence");
const router = require("../routes/attendanceLocationRoutes");

const endedAt = new Date(Date.now() - 5_000).toISOString();
const startedAt = new Date(Date.now() - 65_000).toISOString();
const validEntry = {
  _id: mockTimeEntryId,
  workspace: mockWorkspaceId,
  user: mockUserId,
  isRunning: true,
  clockInSource: "desktop",
  clockInDevice: mockDeviceId,
};

let app: any;
const activityUrl = "/api/attendance/desktop/activity";
const basePayload = {
  workspaceId: mockWorkspaceId,
  timeEntryId: mockTimeEntryId,
  appId: "code.exe",
  startedAt,
  endedAt,
  presenceStatus: "active",
  foregroundAppSupported: true,
  idleDetectionSupported: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  TimeEntry.findOne.mockResolvedValue(validEntry);
  DesktopAppPresence.findOne.mockReturnValue({ sort: () => ({ select: async () => null }) });
  DesktopAppPresence.create.mockResolvedValue({});
  app = express();
  app.use(express.json());
  app.use("/api/attendance", router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));
});

describe("desktop presence heartbeat API", () => {
  it("stores only allowlisted app and active status fields for the same consented desktop shift", async () => {
    const response = await request(app).post(activityUrl).send({ ...basePayload, keyCount: 47, mouseClickCount: 12, typedText: "private" });

    expect(response.status).toBe(201);
    expect(TimeEntry.findOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: mockTimeEntryId,
      workspace: mockWorkspaceId,
      user: mockUserId,
      clockInSource: "desktop",
      clockInDevice: mockDeviceId,
    }));
    expect(DesktopAppPresence.create).toHaveBeenCalledWith(expect.objectContaining({
      user: mockUserId,
      workspace: mockWorkspaceId,
      timeEntry: mockTimeEntryId,
      device: mockDeviceId,
      appId: "code.exe",
      presenceStatus: "active",
      foregroundAppSupported: true,
      idleDetectionSupported: true,
    }));
    expect(JSON.stringify(DesktopAppPresence.create.mock.calls[0][0])).not.toMatch(/keyCount|mouseClickCount|typedText/);
  });

  it("stores AFK when idle detection works but foreground app lookup does not", async () => {
    const response = await request(app).post(activityUrl).send({
      ...basePayload,
      appId: null,
      presenceStatus: "afk",
      foregroundAppSupported: false,
      idleDetectionSupported: true,
    });

    expect(response.status).toBe(201);
    expect(DesktopAppPresence.create).toHaveBeenCalledWith(expect.objectContaining({ appId: null, presenceStatus: "afk", foregroundAppSupported: false, idleDetectionSupported: true }));
  });

  it("stores unavailable when the idle signal is unavailable", async () => {
    const response = await request(app).post(activityUrl).send({
      ...basePayload,
      appId: null,
      presenceStatus: "unavailable",
      foregroundAppSupported: false,
      idleDetectionSupported: false,
    });

    expect(response.status).toBe(201);
    expect(DesktopAppPresence.create).toHaveBeenCalledWith(expect.objectContaining({ presenceStatus: "unavailable", idleDetectionSupported: false }));
  });

  it("rejects invalid statuses and active/AFK claims without idle detection", async () => {
    const invalidStatus = await request(app).post(activityUrl).send({ ...basePayload, presenceStatus: "busy" });
    expect(invalidStatus.status).toBe(400);
    const falseActiveClaim = await request(app).post(activityUrl).send({ ...basePayload, idleDetectionSupported: false });
    expect(falseActiveClaim.status).toBe(400);
    expect(DesktopAppPresence.create).not.toHaveBeenCalled();
  });

  it("rejects a heartbeat when server-side device consent is off", async () => {
    const response = await request(app).post(activityUrl).set("x-consent", "off").send(basePayload);
    expect(response.status).toBe(403);
    expect(DesktopAppPresence.create).not.toHaveBeenCalled();
  });

  it("rejects a clocked-out or different-device entry", async () => {
    TimeEntry.findOne.mockResolvedValueOnce(null);
    const response = await request(app).post(activityUrl).send(basePayload);
    expect(response.status).toBe(409);
    expect(DesktopAppPresence.create).not.toHaveBeenCalled();
  });

  it("keeps existing desktop clients compatible but marks legacy app-only events unavailable", async () => {
    const { presenceStatus: _status, foregroundAppSupported: _appSupported, idleDetectionSupported: _idleSupported, ...legacyPayload } = basePayload;
    const response = await request(app).post(activityUrl).send(legacyPayload);
    expect(response.status).toBe(201);
    expect(DesktopAppPresence.create).toHaveBeenCalledWith(expect.objectContaining({ appId: "code.exe", presenceStatus: "unavailable", idleDetectionSupported: false }));
  });
});