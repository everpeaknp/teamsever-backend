const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");

describe("attendance location data privacy defaults", () => {
  it("excludes member-private remote coordinates from ordinary workspace queries", () => {
    const memberSchema = Workspace.schema.path("members").schema;
    expect(memberSchema.path("privateRemoteAreas").options.select).toBe(false);
    expect(memberSchema.path("temporaryRemoteApprovals").options.select).toBe(false);
  });

  it("excludes clock endpoint coordinates from ordinary time-entry queries", () => {
    expect(TimeEntry.schema.path("clockInLocation").options.select).toBe(false);
    expect(TimeEntry.schema.path("clockOutLocation").options.select).toBe(false);
  });
});
