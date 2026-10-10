type CountableList = { _id: unknown };

type TaskAggregateModel = {
  aggregate: (pipeline: Record<string, unknown>[]) => Promise<Array<{
    _id: unknown;
    taskCount: number;
    completedCount: number;
  }>>;
};

export async function getTaskCountsByList(
  Task: TaskAggregateModel,
  lists: CountableList[],
) {
  if (lists.length === 0) return new Map<string, { taskCount: number; completedCount: number }>();

  const counts = await Task.aggregate([
    { $match: { list: { $in: lists.map((list) => list._id) }, isDeleted: false } },
    {
      $group: {
        _id: "$list",
        taskCount: { $sum: 1 },
        completedCount: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);

  return new Map(counts.map((count) => [String(count._id), {
    taskCount: count.taskCount,
    completedCount: count.completedCount,
  }]));
}
