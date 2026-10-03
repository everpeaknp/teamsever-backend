jest.mock("../models/TimeEntry", () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn().mockResolvedValue(false) }));

const TimeEntry = require("../models/TimeEntry");
const Workspace = require("../models/Workspace");
const PermissionService = require("../permissions/permission.service");
const AttendanceService = require("../services/attendanceService");

describe("attendance report clock endpoint locations", () => {
  const entry = {
    _id: "entry-1", user: { _id: "worker-1", name: "Worker", email: "worker@example.com" },
    startTime: new Date("2026-09-28T08:00:00.000Z"), endTime: new Date("2026-09-28T16:00:00.000Z"),
    isRunning: false, duration: 28800, attendanceMode: "remote", description: "Shift", clockInSource: "desktop", clockOutSource: "desktop",
    clockInLocation: { areaName: "Home", latitude: 27.7, longitude: 85.3, accuracyMeters: 12, capturedAt: new Date("2026-09-28T08:00:00.000Z") },
    clockOutLocation: { latitude: 27.7001, longitude: 85.3001, accuracyMeters: 10, capturedAt: new Date("2026-09-28T16:00:00.000Z"), distanceFromClockInMeters: 15, withinRange: true },
    locationReviewReason: null,
  };
  let query: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Workspace.findById.mockResolvedValue({ _id: "workspace-1", owner: "owner-1", members: [{ user: "admin-1", role: "admin" }] });
    query = { select: jest.fn(function () { return this; }), populate: jest.fn(function () { return this; }), sort: jest.fn(function () { return this; }), skip: jest.fn(function () { return this; }), limit: jest.fn(function () { return this; }), lean: jest.fn().mockResolvedValue([entry]) };
    TimeEntry.find.mockReturnValue(query);
    PermissionService.can.mockResolvedValue(false);
  });

  it("includes both clock endpoint locations for the person viewing their own report", async () => {
    Workspace.findById.mockResolvedValue({ _id: "workspace-1", owner: "worker-1", members: [] });
    const [row] = await AttendanceService.getAttendanceReport("workspace-1", "worker-1", {});
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("+clockInLocation +clockOutLocation"));
    expect(query.select.mock.calls[0][0]).toContain("startTime endTime duration");
    expect(row.clockInLocation).toMatchObject({ areaName: "Home", latitude: 27.7, longitude: 85.3 });
    expect(row.clockOutLocation).toMatchObject({ latitude: 27.7001, longitude: 85.3001, distanceFromClockInMeters: 15, withinRange: true });
    expect(row.clockInSource).toBe("desktop");
    expect(row.clockOutSource).toBe("desktop");
  });

  it("hides exact endpoint coordinates from an admin without address permission", async () => {
    const [row] = await AttendanceService.getAttendanceReport("workspace-1", "admin-1", { userId: "all" });
    expect(row.clockInLocation).toMatchObject({ areaName: "Home" });
    expect(row.clockInLocation.latitude).toBeUndefined();
    expect(row.clockInLocation.longitude).toBeUndefined();
    expect(row.clockOutLocation.latitude).toBeUndefined();
  });

  it("adds endpoint locations to CSV exports", async () => {
    const csv = await AttendanceService.exportAttendanceCSV("workspace-1", "worker-1", {});
    expect(csv).toContain("Clock-in Latitude");
    expect(csv).toContain("Clock-in Source");
    expect(csv).toContain("desktop,desktop");
    expect(csv).toContain("Clock-out Distance (m)");
    expect(csv).toContain("27.7");
  });

  it("returns bounded records with pagination metadata when page is requested", async () => {
    TimeEntry.countDocuments.mockResolvedValue(61);
    const result = await AttendanceService.getAttendanceReport("workspace-1", "admin-1", { page: "2", pageSize: "20" });

    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(result.records).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 61,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("caps requested page size at 100", async () => {
    TimeEntry.countDocuments.mockResolvedValue(1);
    await AttendanceService.getAttendanceReport("workspace-1", "admin-1", { page: "1", pageSize: "500" });

    expect(query.limit).toHaveBeenCalledWith(100);
  });
});
