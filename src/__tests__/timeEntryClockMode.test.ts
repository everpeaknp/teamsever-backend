jest.mock("../models/TimeEntry", () => ({ find: jest.fn() }));
jest.mock("../models/Task", () => ({}));
jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../utils/logger", () => ({}));
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
