const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const QaModule = require("../models/QaModule");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

export const createModule = async (workspaceId: string, actorId: string, input: { name: string; space?: string; projectId?: string }) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  if (!workspace.qualityEnabled) throw new AppError("Quality is not enabled in this workspace", 403);

  const name = input.name?.trim();
  if (!name || name.length > 100) throw new AppError("Module name must be 1–100 characters", 400);
  const { project, filter: projectFilter } = await qaProjectService.getProjectScope(workspaceId, input.projectId, actorId);
  if (project.scopeType === "folder" && input.space && input.space.toString() !== project.space.toString()) throw new AppError("Space does not match the selected QA project", 400);
  if (project.scopeType === "folder" && !input.space) input.space = project.space.toString();
  if (input.space) {
    const space = await Space.findOne({ _id: input.space, workspace: workspaceId, isDeleted: false });
    if (!space) throw new AppError("Space not found in this workspace", 400);
  }

  try {
    return await QaModule.create({ workspace: workspaceId, project: project._id, name, space: input.space, createdBy: actorId });
  } catch (error: any) {
    if (error?.code === 11000) throw new AppError("Module name already exists in this workspace", 409);
    throw error;
  }
};

export const listModules = async (workspaceId: string, rawPage = 1, rawLimit = 30, projectId?: string) => {
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 30)));
  const { filter: projectFilter } = await qaProjectService.getProjectScope(workspaceId, projectId);
  const filter = { workspace: workspaceId, ...projectFilter, isArchived: false };
  const [data, total] = await Promise.all([
    QaModule.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    QaModule.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};

export const setQualityEnabled = async (workspaceId: string, enabled: unknown) => {
  if (typeof enabled !== "boolean") throw new AppError("qualityEnabled must be a boolean", 400);
  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, isDeleted: false },
    { $set: { qualityEnabled: enabled } },
    { new: true, projection: "qualityEnabled" },
  );
  if (!workspace) throw new AppError("Workspace not found", 404);
  return { qualityEnabled: workspace.qualityEnabled };
};

export const archiveModule = async (workspaceId: string, moduleId: string, projectId?: string, actorId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const module = await QaModule.findOneAndUpdate(
    { _id: moduleId, workspace: workspaceId, ...scope.filter, isArchived: false },
    { $set: { isArchived: true } },
    { new: true },
  );
  if (!module) throw new AppError("QA module not found", 404);
  return module;
};
