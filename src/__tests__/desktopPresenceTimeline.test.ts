const express = require("express");
const request = require("supertest");

const workspaceId = "64b000000000000000000001";
const ownerId = "64b000000000000000000002";
const viewerId = "64b000000000000000000003";
const targetId = "64b000000000000000000005";
let mockCanManage: boolean;
let mockMembers: any[];
let mockItems: any[];

jest.mock("../middlewares/authMiddleware", () => ({ protect: (req: any, _res: any, next: any) => { req.user = { id: viewerId }; next(); } }));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn(async () => mockCanManage) }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn(() => ({ select: async () => ({ owner: ownerId, members: mockMembers }) })) }));
jest.mock("../models/User", () => ({ findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: targetId, name: "Ada", profilePicture: "ada.png" }) }) })) }));
jest.mock("../models/DesktopAppPresence", () => ({
  aggregate: jest.fn(async (pipeline: any[]) => pipeline.some((stage: any) => stage.$unionWith) ? mockItems : [{ _id: { appId: "brave.exe", presenceStatus: "active" }, durationMs: 60_000, sessions: 1 }]),
}));
jest.mock("../models/DesktopTrackingGap", () => ({ collection: { name: "desktoptrackinggaps" }, aggregate: jest.fn(async () => [{ gapMs: 0 }]) }));
jest.mock("../models/TimeEntry", () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })) }));
jest.mock("../models/TrustedAttendanceDevice", () => ({ find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })) }));

const router = require("../routes/attendanceLocationRoutes");
const app = express();
app.use("/api/attendance", router);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

beforeEach(() => {
  mockCanManage = false;
  mockMembers = [
    { user: viewerId, status: "active" },
    { user: targetId, status: "active" },
  ];
  mockItems = [{ kind: "app", id: "64b000000000000000000010", appId: "brave.exe", presenceStatus: "active", startedAt: "2026-10-04T10:00:00.000Z", endedAt: "2026-10-04T10:01:00.000Z" }];
});

const url = `/api/attendance/workspace/${workspaceId}/desktop-activity`;
const range = "startDate=2026-10-01&endDate=2026-10-07";

describe("single-member desktop presence history", () => {
  it("requires exactly one target member and rejects team-wide history", async () => {
    const missing = await request(app).get(`${url}?${range}`);
    const all = await request(app).get(`${url}?${range}&userId=all`);

    expect(missing.status).toBe(400);
    expect(all.status).toBe(400);
  });

  it("denies detailed history to regular members even for their own timeline", async () => {
    const response = await request(app).get(`${url}?${range}&userId=${viewerId}`);

    expect(response.status).toBe(403);
  });

  it("lets an authorized attendance manager page one member and returns a range summary", async () => {
    mockCanManage = true;
    const response = await request(app).get(`${url}?${range}&userId=${targetId}&pageSize=1`);

    expect(response.status).toBe(200);
    expect(response.body.data.member).toEqual({ userId: targetId, displayName: "Ada", avatar: "ada.png" });
    expect(response.body.data.summary).toEqual({
      apps: [{ appId: "brave.exe", durationMs: 60_000, sessions: 1 }],
      activeMs: 60_000,
      afkMs: 0,
      gapMs: 0,
    });
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toEqual({ pageSize: 1, hasMore: false, nextCursor: null });
  });

  it("rejects invalid page size, date range, and team-member cursors", async () => {
    mockCanManage = true;
    const invalidSize = await request(app).get(`${url}?${range}&userId=${targetId}&pageSize=101`);
    const tooLong = await request(app).get(`${url}?startDate=2026-01-01&endDate=2026-04-10&userId=${targetId}`);
    const malformedCursor = await request(app).get(`${url}?${range}&userId=${targetId}&cursor=not-a-cursor`);

    expect(invalidSize.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(malformedCursor.status).toBe(400);
  });
});



describe("authorization is checked for every detail page", () => {
  it("denies the next page immediately after the viewer loses attendance permission", async () => {
    mockCanManage = true;
    mockItems = [
      { kind: "app", id: "64b000000000000000000011", appId: "brave.exe", presenceStatus: "active", startedAt: "2026-10-04T10:01:00.000Z", endedAt: "2026-10-04T10:02:00.000Z" },
      { kind: "app", id: "64b000000000000000000010", appId: "chrome.exe", presenceStatus: "afk", startedAt: "2026-10-04T10:00:00.000Z", endedAt: "2026-10-04T10:01:00.000Z" },
    ];
    const firstPage = await request(app).get(`${url}?${range}&userId=${targetId}&pageSize=1`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.pagination.hasMore).toBe(true);
    const cursor = encodeURIComponent(firstPage.body.data.pagination.nextCursor);

    mockCanManage = false;
    const nextPage = await request(app).get(`${url}?${range}&userId=${targetId}&pageSize=1&cursor=${cursor}`);

    expect(nextPage.status).toBe(403);
  });
});
