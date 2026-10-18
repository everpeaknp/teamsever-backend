const express = require("express");
const request = require("supertest");

const userId = "64b000000000000000000001";
const deviceId = "64b000000000000000000002";
const entryId = "64b000000000000000000003";
const workspaceId = "64b000000000000000000004";
const fingerprint = "same-network-fingerprint";
let mockEntry: any;
let mockDevice: any;

jest.mock("../middlewares/authMiddleware", () => ({ protect: (req: any, _res: any, next: any) => { req.user = { id: userId }; next(); } }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (req: any, _res: any, next: any) => { req.user = { id: userId }; req.desktopDevice = mockDevice; next(); } }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../models/TimeEntry", () => ({
  findOne: jest.fn(() => ({ select: () => ({ sort: async () => mockEntry, then: (resolve: any, reject: any) => Promise.resolve(mockEntry).then(resolve, reject) }) })),
  findOneAndUpdate: jest.fn(async () => ({ _id: entryId })),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
}));
jest.mock("../services/attendanceNetworkFingerprint", () => ({ attendanceNetworkFingerprint: () => fingerprint }));
jest.mock("../utils/attendanceClientIp", () => ({ resolveAttendanceClientIp: async () => "203.0.113.10" }));

const router = require("../routes/attendanceLocationRoutes");
const app = express();
app.use(express.json());
app.use("/api/attendance", router);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

beforeEach(() => {
  mockEntry = {
    _id: entryId,
    workspace: workspaceId,
    startTime: new Date("2026-10-19T08:00:00.000Z"),
    clockInSource: "mobile",
    networkFingerprint: fingerprint,
    networkFingerprintExpiresAt: new Date(Date.now() + 60_000),
    companionDismissedDevices: [],
  };
  mockDevice = { _id: deviceId, activityMonitoringEnabled: false, autoSyncMobileShifts: false, save: jest.fn(async function(this: any) { return this; }) };
});

describe("desktop mobile-shift consent prompt", () => {
  it("returns an eligible mobile shift while desktop monitoring consent is still off", async () => {
    const response = await request(app).get("/api/attendance/desktop/status");

    expect(response.status).toBe(200);
    expect(response.body.data.activityMonitoringEnabled).toBe(false);
    expect(response.body.data.pendingMobileShift).toEqual({
      timeEntryId: entryId,
      workspaceId,
      startTime: "2026-10-19T08:00:00.000Z",
    });
  });

  it("records consent and links the shift when the user accepts the prompt", async () => {
    const response = await request(app)
      .post(`/api/attendance/desktop/companion/${entryId}/respond`)
      .send({ action: "sync_once" });

    expect(response.status).toBe(200);
    expect(mockDevice.activityMonitoringEnabled).toBe(true);
    expect(mockDevice.activityMonitoringEnabledAt).toBeInstanceOf(Date);
    expect(mockDevice.save).toHaveBeenCalledTimes(1);
    expect(response.body.data.synced).toBe(true);
  });
});
