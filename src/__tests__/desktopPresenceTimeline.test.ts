const express = require("express");
const request = require("supertest");

const mockWorkspaceId = "64b000000000000000000001";
const mockUserId = "64b000000000000000000003";
const mockOtherUserId = "64b000000000000000000005";
let mockTeamPermission = false;
let mockOwnActiveDesktopShift = false;
let mockMemberStatus = "active";
const mockEvents = [{ _id: "event-1", presenceStatus: "afk", appId: null, startedAt: new Date("2026-10-01T08:00:00Z"), endedAt: new Date("2026-10-01T08:01:00Z") }];
const mockGaps = [{ _id: "gap-1", gapStartedAt: new Date("2026-10-01T08:01:00Z"), gapEndedAt: new Date("2026-10-01T08:02:00Z"), reason: "presence_heartbeat_missing" }];

jest.mock("../middlewares/authMiddleware", () => ({ protect: (req: any, _res: any, next: any) => { req.user = { id: mockUserId }; next(); } }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn(async () => mockTeamPermission) }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn(() => ({ select: async () => ({ owner: "owner-id", members: [{ user: mockUserId, status: mockMemberStatus }, { user: mockOtherUserId, status: "active" }] }) })) }));
jest.mock("../models/DesktopAppPresence", () => ({ find: jest.fn(() => { const query: any = {}; query.select = () => query; query.populate = () => query; query.sort = () => query; query.limit = () => query; query.lean = async () => mockEvents; return query; }) }));
jest.mock("../models/DesktopTrackingGap", () => ({ find: jest.fn(() => { const query: any = {}; query.select = () => query; query.populate = () => query; query.sort = () => query; query.limit = () => query; query.lean = async () => mockGaps; return query; }) }));
jest.mock("../models/TimeEntry", () => ({ find: jest.fn(() => ({ select: () => ({ populate: () => ({ lean: async () => [] }) }) })), exists: jest.fn(async () => mockOwnActiveDesktopShift) }));
jest.mock("../models/TrustedAttendanceDevice", () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })) }));

const router = require("../routes/attendanceLocationRoutes");
const app = express();
app.use("/api/attendance", router);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

describe("desktop presence timeline authorization and filtering", () => {
  beforeEach(() => { mockTeamPermission = false; mockOwnActiveDesktopShift = false; mockMemberStatus = "active"; });

  it("allows an active member to read only their own presence by default", async () => {
    const response = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=2026-10-01&endDate=2026-10-01`);
    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(1);
    expect(response.body.data.gaps).toHaveLength(1);
  });

  it("allows a user with their own active desktop-tracked shift to read only their own timeline", async () => {
    mockMemberStatus = "inactive";
    mockOwnActiveDesktopShift = true;
    const response = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=2026-10-01&endDate=2026-10-01`);
    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(1);
    expect(response.body.data.gaps).toHaveLength(1);
  });

  it("does not let the active-shift fallback expose a team timeline", async () => {
    mockMemberStatus = "inactive";
    mockOwnActiveDesktopShift = true;
    const response = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?userId=all`);
    expect(response.status).toBe(403);
  });

  it("rejects a team timeline without an attendance or address manager permission", async () => {
    const response = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?userId=all`);
    expect(response.status).toBe(403);
  });

  it("allows existing address managers to read authorized team presence", async () => {
    mockTeamPermission = true;
    const response = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?userId=all`);
    expect(response.status).toBe(200);
    expect(response.body.data.events).toHaveLength(1);
  });

  it("rejects malformed and reversed date ranges", async () => {
    const malformed = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=not-a-date`);
    const missingPair = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=2026-10-01`);
    const impossible = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=2026-02-30&endDate=2026-03-01`);
    const reversed = await request(app).get(`/api/attendance/workspace/${mockWorkspaceId}/desktop-activity?startDate=2026-10-03&endDate=2026-10-01`);
    expect(malformed.status).toBe(400);
    expect(missingPair.status).toBe(400);
    expect(impossible.status).toBe(400);
    expect(reversed.status).toBe(400);
  });
});
