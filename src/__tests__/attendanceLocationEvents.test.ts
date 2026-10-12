jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../models/TimeEntry", () => ({ findOne: jest.fn() }));
jest.mock("../models/AttendanceLocationEvent", () => ({ updateMany: jest.fn().mockResolvedValue({}), findOne: jest.fn(), create: jest.fn().mockResolvedValue({ _id: "event-id" }) }));

const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const Events = require("../models/AttendanceLocationEvent");
const Service = require("../services/attendanceLocationService");

describe("attendance location check event security and review state", () => {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const timeEntryId = new mongoose.Types.ObjectId().toString();
  const officeId = new mongoose.Types.ObjectId().toString();
  beforeEach(() => {
    jest.clearAllMocks();
    Workspace.findOne.mockResolvedValue({
      _id: workspaceId,
      owner: new mongoose.Types.ObjectId(),
      members: [{ user: userId, status: "active", attendanceMode: "onsite" }],
      attendanceLocationPolicy: { enabled: true, maxAccuracyMeters: 100, areas: [{ _id: officeId, kind: "office", isActive: true, latitude: 40, longitude: -74, radiusMeters: 150 }] }
    });
    TimeEntry.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: timeEntryId }) });
    Events.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
  });

  it("scopes event writes to the authenticated user's running entry in this workspace", async () => {
    TimeEntry.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(Service.recordLocationCheck(workspaceId, userId, timeEntryId, "unavailable")).rejects.toThrow("Running time entry not found");
    expect(TimeEntry.findOne).toHaveBeenCalledWith({ _id: timeEntryId, workspace: workspaceId, user: userId, isRunning: true, isDeleted: false });
    expect(Events.create).not.toHaveBeenCalled();
  });

  it("records unavailable states as a review flag without writing raw coordinates", async () => {
    await Service.recordLocationCheck(workspaceId, userId, timeEntryId, "unavailable");
    expect(Events.create).toHaveBeenCalledWith(expect.objectContaining({ status: "unavailable", activeReviewFlag: true }));
    const saved = Events.create.mock.calls[0][0];
    expect(saved).not.toHaveProperty("latitude");
    expect(saved).not.toHaveProperty("longitude");
  });

  it("clears the active review flag on recovery and keeps an inside event", async () => {
    const capturedAt = new Date().toISOString();
    await Service.recordLocationCheck(workspaceId, userId, timeEntryId, "location", { latitude: 40, longitude: -74, accuracyMeters: 10, capturedAt });
    expect(Events.updateMany).toHaveBeenCalledWith({ timeEntry: timeEntryId, activeReviewFlag: true }, { $set: { activeReviewFlag: false } });
    expect(Events.create).toHaveBeenCalledWith(expect.objectContaining({ status: "inside", activeReviewFlag: false, areaId: expect.anything() }));
    expect(Events.create.mock.calls[0][0]).not.toHaveProperty("latitude");
  });

  it("records the location actually matched during a remote member's office shift", async () => {
    const workspace = await Workspace.findOne();
    workspace.members[0].attendanceMode = "remote";
    TimeEntry.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: timeEntryId, attendanceMode: "onsite" }) });

    await Service.recordLocationCheck(workspaceId, userId, timeEntryId, "location", {
      latitude: 40, longitude: -74, accuracyMeters: 10, capturedAt: new Date().toISOString()
    });

    expect(Events.create).toHaveBeenCalledWith(expect.objectContaining({ areaId: officeId, mode: "onsite", status: "inside" }));
  });
});
