jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../models/TimeEntry", () => ({ findOne: jest.fn() }));
jest.mock("../models/AttendanceLocationEvent", () => ({ findOne: jest.fn(), create: jest.fn(), updateOne: jest.fn() }));
jest.mock("../services/analyticsV2CacheService", () => ({ invalidateWorkspace: jest.fn() }));
jest.mock("../services/attendanceLocationService", () => ({
  assertActiveMember: jest.fn((_workspace, userId) => ({ user: userId, attendanceMode: "onsite" })),
  eligibleAreasForMember: jest.fn(() => []),
  validateClockOutLocation: jest.fn(),
}));
jest.mock("../utils/attendanceClientIp", () => ({ resolveAttendanceClientIp: jest.fn().mockResolvedValue(null) }));
jest.mock("../services/desktopClockAuthorization", () => ({
  canClockOutFromClient: jest.fn().mockReturnValue(true),
  resolveAttendanceClockSource: jest.fn().mockReturnValue("web"),
}));
jest.mock("../services/attendanceNetworkFingerprint", () => ({ attendanceNetworkFingerprint: jest.fn() }));
jest.mock("mongoose", () => {
  const actual = jest.requireActual("mongoose");
  return { ...actual, startSession: jest.fn(() => ({ withTransaction: (callback: Function) => callback(), endSession: jest.fn() })) };
});

const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const AttendanceLocationService = require("../services/attendanceLocationService");
const { toggleWorkspaceClock } = require("../controllers/workspaceMemberController");

describe("workspace clock-out location enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const workspace = {
      owner: "owner-1",
      members: [{ user: "worker-1", attendanceMode: "onsite", status: "active" }],
      attendanceLocationPolicy: { enabled: true, maxAccuracyMeters: 100 },
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
    };
    Workspace.findOne.mockReturnValue({ select: () => ({ session: jest.fn().mockResolvedValue(workspace) }) });
    TimeEntry.findOne.mockReturnValue({ select: () => ({ session: jest.fn().mockResolvedValue({
      _id: new (require("mongoose").Types.ObjectId)(), user: "worker-1", isRunning: true, save: jest.fn().mockResolvedValue(undefined),
    }) }) });
  });

  it("keeps the shift running when clock-out is outside authorized areas", async () => {
    const blocked = new Error("You are outside your allowed attendance area");
    Object.assign(blocked, { statusCode: 403 });
    AttendanceLocationService.validateClockOutLocation.mockRejectedValue(blocked);
    const next = jest.fn();
    const req = { params: { id: new (require("mongoose").Types.ObjectId)().toString() }, body: { status: "inactive", locationFix: { latitude: 1, longitude: 1, accuracyMeters: 10, capturedAt: new Date().toISOString() } }, user: { id: "worker-1" }, ip: "127.0.0.1" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await new Promise<void>((resolve) => {
      toggleWorkspaceClock(req, res, (error: any) => { next(error); resolve(); });
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      message: expect.stringContaining("Clock-out blocked: You are outside your allowed attendance area"),
    }));
    expect(res.json).not.toHaveBeenCalled();
  });
});
