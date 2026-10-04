const express = require("express");
const request = require("supertest");

jest.mock("../middlewares/authMiddleware", () => ({ protect: (_req: any, res: any) => res.status(401).json({ message: "web login required" }) }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (req: any, res: any, next: any) => req.headers["x-teamsever-device"] ? next() : res.status(401).json({ message: "desktop credential required" }) }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../controllers/desktopAttendanceController", () => ({
  getDeviceStatus: (_req: any, res: any) => res.status(200).json({ success: true, data: { clockedIn: false } }),
  attachPresenceToActiveShift: (_req: any, res: any) => res.status(200).json({ success: true }),
  recordAppPresence: (_req: any, res: any) => res.status(201).json({ success: true }),
  createDevice: (_req: any, res: any) => res.status(201).json({ success: true }),
  listDevices: (_req: any, res: any) => res.status(200).json({ success: true }),
  revokeDevice: (_req: any, res: any) => res.status(200).json({ success: true }),
  setActivityConsent: (_req: any, res: any) => res.status(200).json({ success: true }),
  setAutoSyncMobileShifts: (_req: any, res: any) => res.status(200).json({ success: true }),
  createMobilePairingCode: (_req: any, res: any) => res.status(200).json({ success: true }),
  pairMobileShiftWithCode: (_req: any, res: any) => res.status(200).json({ success: true }),
  respondToMobileShift: (_req: any, res: any) => res.status(200).json({ success: true }),
  getWorkspaceCurrentPresence: (_req: any, res: any) => res.status(200).json({ success: true, data: { members: [] } }),
  getAppPresence: (_req: any, res: any) => res.status(200).json({ success: true }),
  getDesktopPresencePolicy: (_req: any, res: any) => res.status(200).json({ success: true, data: { policy: { afkThresholdMinutes: 5 } } }),
  updateDesktopPresencePolicy: (_req: any, res: any) => res.status(200).json({ success: true }),
}));

const attendanceLocationRoutes = require("../routes/attendanceLocationRoutes");

describe("desktop attendance routes", () => {
  it("accepts device credentials for desktop polling without requiring a web JWT", async () => {
    const app = express();
    app.use("/api/attendance", attendanceLocationRoutes);
    const response = await request(app).get("/api/attendance/desktop/status").set("X-TeamsEver-Device", "td_test");
    expect(response.status).toBe(200);
  });

  it("lets the trusted desktop load its AFK policy without requiring a web JWT", async () => {
    const app = express();
    app.use("/api/attendance", attendanceLocationRoutes);
    const response = await request(app)
      .get("/api/attendance/desktop/workspace/64b000000000000000000001/presence-policy")
      .set("X-TeamsEver-Device", "td_test");
    expect(response.status).toBe(200);
    expect(response.body.data.policy.afkThresholdMinutes).toBe(5);
  });

  it("keeps device registration behind normal web authentication", async () => {
    const app = express();
    app.use("/api/attendance", attendanceLocationRoutes);
    const response = await request(app).post("/api/attendance/desktop-devices").send({ name: "Desktop", platform: "windows" });
    expect(response.status).toBe(401);
  });

  it("keeps pairing-code claims behind the trusted desktop credential middleware", async () => {
    const app = express();
    app.use("/api/attendance", attendanceLocationRoutes);
    const response = await request(app).post("/api/attendance/desktop/companion/pair").send({ code: "123456" });
    expect(response.status).toBe(401);
  });
});
