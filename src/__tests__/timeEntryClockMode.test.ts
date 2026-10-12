jest.mock("../models/TimeEntry", () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock("../models/Task", () => ({}));
jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../socket/events", () => ({}));
jest.mock("../services/analyticsV2CacheService", () => ({}));

const TimeEntry = require("../models/TimeEntry");
const Workspace = require("../models/Workspace");
const timeEntryService = require("../services/timeEntryService");

describe("workspace clock status", () => {
  it("returns the actual office or remote mode for active clock-ins", async () => {
    Workspace.findOne.mockResolvedValue({
      _id: "workspace-1",
      owner: "manager-1",
      members: [],
    });
    const query: any = {
      select: jest.fn(() => query),
      populate: jest.fn(() => query),
      sort: jest.fn(() => query),
      lean: jest.fn().mockResolvedValue([
        { _id: "entry-1", attendanceMode: "remote", startTime: new Date() },
      ]),
    };
    TimeEntry.find.mockReturnValue(query);

    const result = await timeEntryService.getWorkspaceClockStatus("workspace-1", "manager-1");

    expect(query.select).toHaveBeenCalledWith("user task project startTime description isRunning attendanceMode");
    expect(result.activeTimers[0].attendanceMode).toBe("remote");
  });
});

describe("workspace admin clock-out reason", () => {
  it("stores the optional reason on the entry and in the audit activity", async () => {
    const TimeEntry = require("../models/TimeEntry");
    const Workspace = require("../models/Workspace");
    const logger = require("../utils/logger");
    const timeEntryService = require("../services/timeEntryService");
    const entry: any = {
      _id: { toString: () => "entry-1" }, workspace: { toString: () => "workspace-1" },
      user: { toString: () => "worker-1" }, task: null, duration: 60, isRunning: true,
      save: jest.fn().mockResolvedValue(undefined), populate: jest.fn().mockResolvedValue(undefined),
    };
    TimeEntry.findOne.mockResolvedValue(entry);
    Workspace.findOne.mockResolvedValue({ owner: { toString: () => "owner-1" }, members: [] });

    await timeEntryService.adminStopTimer("entry-1", "owner-1", "Left the approved office before clocking out");

    expect(entry.adminClockOutReason).toBe("Left the approved office before clocking out");
    expect(entry.save).toHaveBeenCalled();
    expect(logger.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ reason: "Left the approved office before clocking out" }),
    }));
  });
});
