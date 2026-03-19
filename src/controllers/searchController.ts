const asyncHandler = require("../utils/asyncHandler");
const Task = require("../models/Task");
const Space = require("../models/Space");
const List = require("../models/List");

/**
 * @desc    Global search across tasks, spaces, and lists
 * @route   GET /api/search?q=query
 * @access  Private
 */
const handleGlobalSearch = asyncHandler(async (req: any, res: any) => {
  const { q } = req.query;
  const userId = req.user.id;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({
      tasks: [],
      spaces: [],
      lists: [],
    });
  }

  const searchQuery = q.trim();

  // Search across all three collections in parallel
  const [tasks, spaces, lists] = await Promise.all([
    // Search tasks by title
    Task.find({
      title: { $regex: searchQuery, $options: "i" },
      isDeleted: false,
    })
      .populate("workspace", "name")
      .populate("space", "name")
      .populate("list", "name")
      .populate("assignee", "name email")
      .limit(5)
      .sort({ updatedAt: -1 })
      .lean(),

    // Search spaces by name
    Space.find({
      name: { $regex: searchQuery, $options: "i" },
      isDeleted: false,
      $or: [
        { owner: userId },
        { "members.user": userId },
      ],
    })
      .populate("workspace", "name")
      .limit(5)
      .sort({ updatedAt: -1 })
      .lean(),

    // Search lists by name
    List.find({
      name: { $regex: searchQuery, $options: "i" },
      isDeleted: false,
    })
      .populate("workspace", "name")
      .populate("space", "name")
      .limit(5)
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  res.json({
    tasks,
    spaces,
    lists,
  });
});

module.exports = { handleGlobalSearch };

export {};
