const { backfillTaskWorkItemType } = require("../scripts/backfillTaskWorkItemType");

describe("task work item backfill", () => {
  it("sets only missing types so reruns cannot turn a bug into a task", async () => {
    const Task = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }) };
    const result = await backfillTaskWorkItemType(Task);
    expect(Task.updateMany).toHaveBeenCalledWith(
      { workItemType: { $exists: false } },
      { $set: { workItemType: "task" } },
    );
    expect(result.modifiedCount).toBe(2);
  });
});
