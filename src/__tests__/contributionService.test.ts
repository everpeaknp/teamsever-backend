jest.mock("../models/WorkspaceActivity", () => ({ aggregate: jest.fn() }));
jest.mock("../models/Task", () => ({ aggregate: jest.fn() }));
jest.mock("../models/Activity", () => ({ aggregate: jest.fn() }));

const WorkspaceActivity = require("../models/WorkspaceActivity");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const contributionService = require("../services/contributionService");

describe("contribution history", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns full calendar-year counts across all contribution sources", async () => {
    WorkspaceActivity.aggregate.mockResolvedValue([
      { _id: "2024-02-14", count: 2 },
    ]);
    Task.aggregate.mockResolvedValue([
      { _id: "2024-02-14", count: 1 },
    ]);
    Activity.aggregate.mockResolvedValue([
      { _id: "2025-07-03", count: 4 },
    ]);

    const result = await contributionService.getDailyContributions(
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      "all",
    );

    expect(result.dailyCounts).toEqual({
      "2024-02-14": 3,
      "2025-07-03": 4,
    });
    for (const model of [WorkspaceActivity, Task, Activity]) {
      const [pipeline] = model.aggregate.mock.calls[0];
      expect(pipeline[0].$match.createdAt).toBeUndefined();
      expect(pipeline[1].$group._id.$dateToString.format).toBe("%Y-%m-%d");
    }
  });
});
