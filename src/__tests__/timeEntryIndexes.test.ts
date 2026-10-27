const TimeEntry = require("../models/TimeEntry");

describe("time entry query indexes", () => {
  it("supports workspace clock status filtering and newest-first sorting", () => {
    const indexes = TimeEntry.schema.indexes().map(([keys]: [Record<string, number>]) => keys);

    expect(indexes).toContainEqual({
      workspace: 1,
      isRunning: 1,
      isDeleted: 1,
      startTime: -1,
    });
  });
});
