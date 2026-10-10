const List = require("../models/List");
const Task = require("../models/Task");
const PermissionService = require("../permissions/permission.service");
const AppError = require("../utils/AppError");

export const listBugs = async (workspaceId: string, actorId: string, raw: any = {}) => {
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const lists = await List.find({ workspace: workspaceId, isDeleted: false }).select("_id space").lean();
  const accessible = await Promise.all(lists.map(async (list: any) => ({
    id: list._id,
    allowed: await PermissionService.can(actorId, "VIEW_LIST", { workspaceId, userId: actorId, listId: list._id.toString(), spaceId: list.space.toString() }),
  })));
  const listIds = accessible.filter((list: any) => list.allowed).map((list: any) => list.id);
  if (raw.listId && !listIds.some((id: any) => id.toString() === raw.listId)) throw new AppError("List not available", 403);
  const filter: any = { workspace: workspaceId, list: raw.listId || { $in: listIds }, workItemType: "bug", isDeleted: false };
  if (raw.status) {
    if (!["todo", "inprogress", "review", "done", "cancelled"].includes(raw.status)) throw new AppError("Invalid bug status", 400);
    filter.status = raw.status;
  }
  if (raw.severity) {
    if (!["low", "medium", "high", "critical"].includes(raw.severity)) throw new AppError("Invalid severity", 400);
    filter["bugDetails.severity"] = raw.severity;
  }
  if (raw.search) {
    if (typeof raw.search !== "string" || raw.search.length > 120) throw new AppError("Search is too long", 400);
    filter.title = { $regex: raw.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }
  const [data, total] = await Promise.all([
    Task.find(filter).select("title status priority bugDetails list space assignee qaReviewer moduleId qaSourceExecution updatedAt createdAt")
      .sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};
