const asyncHandler = require("../utils/asyncHandler");
const Task = require("../models/Task");
const Space = require("../models/Space");
const List = require("../models/List");
const Workspace = require("../models/Workspace");
const ListMember = require("../models/ListMember").ListMember;
const AppError = require("../utils/AppError");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchWorkspace = async (req: any, query: string) => {
  const workspaceId = req.query.workspaceId;
  const userId = req.user.id;
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isDeleted: false,
  }).select("owner members").lean();

  if (!workspace) throw new AppError("Workspace not found", 404);

  const member = workspace.members?.find((entry: any) => String(entry.user) === userId);
  const isOwner = String(workspace.owner) === userId;
  if (!isOwner && !member) {
    throw new AppError("You do not have access to this workspace", 403);
  }

  const privileged = isOwner || ["admin", "owner", "operations_manager", "project_manager"]
    .includes(String(member?.role || ""));
  const spaceQuery: any = { workspace: workspaceId, isDeleted: false };
  if (!privileged) {
    spaceQuery.$or = [{ owner: userId }, { "members.user": userId }];
  }
  const visibleSpaces = await Space.find(spaceQuery).select("_id name").lean();
  const memberSpaceIds = visibleSpaces.map((space: any) => space._id);
  const visibleSpaceIds = [...memberSpaceIds];
  let memberListIds: any[] = [];

  if (!privileged) {
    memberListIds = await ListMember.distinct("list", {
      user: userId,
      workspace: workspaceId,
    });
    const listSpaceIds = await ListMember.distinct("space", {
      user: userId,
      workspace: workspaceId,
    });
    for (const id of listSpaceIds) {
      if (!visibleSpaceIds.some((spaceId: any) => String(spaceId) === String(id))) {
        visibleSpaceIds.push(id);
      }
    }
  }

  const safeQuery = escapeRegex(query);
  const nameRegex = new RegExp(safeQuery, "i");
  const listAccess: any[] = [];
  if (privileged || memberSpaceIds.length) {
    listAccess.push({ space: { $in: privileged ? visibleSpaceIds : memberSpaceIds } });
  }
  if (!privileged && memberListIds.length) {
    listAccess.push({ _id: { $in: memberListIds } });
  }
  const accessibleListIds = listAccess.length
    ? await List.distinct("_id", {
        workspace: workspaceId,
        isDeleted: false,
        $or: listAccess,
      })
    : [];
  const matchingLists = listAccess.length
    ? await List.find({
        workspace: workspaceId,
        isDeleted: false,
        name: nameRegex,
        $or: listAccess,
      }).select("_id name space").lean()
    : [];
  const taskQuery: any = {
    workspace: workspaceId,
    space: { $in: visibleSpaceIds },
    list: { $in: accessibleListIds },
    isDeleted: false,
    $or: [
      { title: nameRegex },
      { description: nameRegex },
      { "bugDetails.reproductionSteps": nameRegex },
      { "bugDetails.expectedResult": nameRegex },
      { "bugDetails.actualResult": nameRegex },
      { "bugDetails.environment": nameRegex },
      { "bugDetails.build": nameRegex },
    ],
  };
  if (matchingLists.length) {
    taskQuery.$or.push({ list: { $in: matchingLists.map((list: any) => list._id) } });
  }
  const allowedStatuses = ["todo", "inprogress", "review", "done", "blocked", "cancelled"];
  if (allowedStatuses.includes(String(req.query.status || ""))) {
    taskQuery.status = req.query.status;
  }
  if (req.query.assignedToMe === "true") taskQuery.assignee = userId;
  if (req.query.createdByMe === "true") taskQuery.createdBy = userId;

  const tasks = await Task.find(taskQuery)
    .populate("list", "name")
    .populate("space", "name")
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .sort({ updatedAt: -1 })
    .limit(60)
    .lean();

  return {
    tasks,
    spaces: visibleSpaces.filter((space: any) => nameRegex.test(space.name || "")),
    lists: matchingLists,
  };
};

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

  if (typeof req.query.workspaceId === "string" && req.query.workspaceId.trim()) {
    const results = await searchWorkspace(req, searchQuery);
    return res.json(results);
  }

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
