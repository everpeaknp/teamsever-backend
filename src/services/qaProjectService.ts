const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const Folder = require("../models/Folder");
const QaProject = require("../models/QaProject");
const List = require("../models/List");
const AppError = require("../utils/AppError");

const DEFAULT_SETTINGS = {
  caseTypes: [
    { key: "manual", label: "Manual", enabled: true },
    { key: "automated", label: "Automated", enabled: true },
    { key: "exploratory", label: "Exploratory", enabled: true },
    { key: "gherkin", label: "Gherkin", enabled: true },
  ],
  caseStatuses: [
    { key: "draft", label: "Draft", terminal: false },
    { key: "active", label: "Active", terminal: false },
    { key: "retired", label: "Retired", terminal: true },
  ],
  caseTransitions: { draft: ["active", "retired"], active: ["draft", "retired"], retired: ["draft"] },
  caseFields: [
    { key: "priority", label: "Priority", type: "select", required: false, enabled: true, options: ["low", "medium", "high", "urgent"] },
    { key: "platform", label: "Platform", type: "select", required: false, enabled: true, options: ["Web", "Mobile", "API", "Desktop"] },
    { key: "risk", label: "Risk", type: "select", required: false, enabled: true, options: ["low", "medium", "high"] },
  ],
  run: { environments: [], platforms: [], requireFailureReason: true, requireFailureEvidence: false },
  bugHandoff: { defaultListId: null, copyRunContext: true },
  notifications: { runAssigned: true, failureRecorded: true, runClosed: true },
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

const ensureWorkspaceProject = async (workspaceId: string, actorId?: string) => {
  if (!mongoose.isValidObjectId(workspaceId)) throw new AppError("Workspace ID is invalid", 400);
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false }).select("owner qualityEnabled").lean();
  if (!workspace) throw new AppError("Workspace not found", 404);
  const project = await QaProject.findOneAndUpdate(
    { workspace: workspaceId, scopeType: "workspace", folder: null },
    { $set: { isArchived: false }, $setOnInsert: { name: "Workspace project", scopeType: "workspace", folder: null, space: null, settingsOverrides: {}, createdBy: actorId || workspace.owner } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return { project, workspace };
};

const resolveProject = async (workspaceId: string, projectId?: string, actorId?: string) => {
  if (!projectId || projectId === "workspace") return (await ensureWorkspaceProject(workspaceId, actorId)).project;
  if (!mongoose.isValidObjectId(projectId)) throw new AppError("QA project ID is invalid", 400);
  const project = await QaProject.findOne({ _id: projectId, workspace: workspaceId, isArchived: false }).lean();
  if (!project) throw new AppError("QA project not found in this workspace", 404);
  return project;
};

const getProjectScope = async (workspaceId: string, projectId?: string, actorId?: string) => {
  const project = await resolveProject(workspaceId, projectId, actorId);
  return {
    project,
    // Existing workspace-scoped QA data is treated as belonging to the
    // Workspace project until a manager explicitly moves it.
    filter: project.scopeType === "workspace"
      ? { project: { $in: [project._id, null] } }
      : { project: project._id },
  };
};

const effectiveSettings = (workspace: any, project: any) => {
  const defaults = { ...cloneDefaults(), ...(workspace.qualityDefaults || {}) };
  const overrides = project?.settingsOverrides || {};
  return {
    ...defaults,
    ...overrides,
    run: { ...defaults.run, ...(overrides.run || {}) },
    bugHandoff: { ...defaults.bugHandoff, ...(overrides.bugHandoff || {}) },
    notifications: { ...defaults.notifications, ...(overrides.notifications || {}) },
    inherited: Object.keys(overrides).length === 0,
  };
};

const validateSettings = (input: any) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("Quality settings must be an object", 400);
  const settings: any = {};
  for (const key of ["caseTypes", "caseStatuses", "caseTransitions", "caseFields", "run", "bugHandoff", "notifications"]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) settings[key] = input[key];
  }
  const validList = (value: any, label: string, max: number) => {
    if (!Array.isArray(value) || value.length > max) throw new AppError(`${label} must be a list of up to ${max} items`, 400);
    const keys = new Set<string>();
    return value.map((item: any) => {
      if (!item || typeof item !== "object" || typeof item.key !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(item.key) || typeof item.label !== "string" || !item.label.trim() || item.label.trim().length > 80) throw new AppError(`${label} contains an invalid item`, 400);
      if (keys.has(item.key)) throw new AppError(`${label} keys must be unique`, 400);
      keys.add(item.key);
      return { ...item, label: item.label.trim() };
    });
  };
  if (settings.caseTypes !== undefined) {
    settings.caseTypes = validList(settings.caseTypes, "Case types", 12).map((item: any) => ({ key: item.key, label: item.label, enabled: item.enabled !== false }));
    if (!settings.caseTypes.some((item: any) => item.enabled)) throw new AppError("Keep at least one case type enabled", 400);
  }
  if (settings.caseStatuses !== undefined) {
    settings.caseStatuses = validList(settings.caseStatuses, "Case statuses", 12).map((item: any) => ({ key: item.key, label: item.label, terminal: Boolean(item.terminal) }));
    if (!settings.caseStatuses.length) throw new AppError("Keep at least one case status", 400);
  }
  if (settings.caseTransitions !== undefined) {
    if (!settings.caseTransitions || typeof settings.caseTransitions !== "object" || Array.isArray(settings.caseTransitions)) throw new AppError("Case transitions must map states to allowed next states", 400);
    const stateKeys = new Set((settings.caseStatuses || cloneDefaults().caseStatuses).map((item: any) => item.key));
    for (const [from, to] of Object.entries(settings.caseTransitions)) {
      if (!stateKeys.has(from) || !Array.isArray(to) || to.length > 12 || to.some((state: string) => !stateKeys.has(state))) throw new AppError("Case transitions reference an unknown status", 400);
    }
  }
  if (settings.caseFields !== undefined) {
    settings.caseFields = validList(settings.caseFields, "Case fields", 30).map((item: any) => {
      if (item.key === "priority" && (item.type !== "select" || item.required || JSON.stringify(item.options || []) !== JSON.stringify(["low", "medium", "high", "urgent"]))) throw new AppError("Priority is a built-in field and its choices cannot be changed", 400);
      if (item.key !== "priority" && ["title", "state", "type", "steps", "moduleId", "suiteId", "priority"].includes(item.key)) throw new AppError(`${item.key} is reserved for a built-in case field`, 400);
      if (!["text", "number", "select", "multiselect", "checkbox", "date"].includes(item.type)) throw new AppError(`Field ${item.label} has an unsupported type`, 400);
      const options = item.options === undefined ? [] : item.options;
      if (!Array.isArray(options) || options.length > 50 || options.some((option: any) => typeof option !== "string" || !option.trim() || option.length > 80)) throw new AppError(`Field ${item.label} has invalid options`, 400);
      if (["select", "multiselect"].includes(item.type) && options.length === 0) throw new AppError(`Field ${item.label} needs at least one option`, 400);
      return { key: item.key, label: item.label, type: item.type, required: Boolean(item.required), enabled: item.enabled !== false, options: options.map((option: string) => option.trim()) };
    });
  }
  for (const section of ["run", "bugHandoff", "notifications"]) {
    if (settings[section] !== undefined && (!settings[section] || typeof settings[section] !== "object" || Array.isArray(settings[section]))) throw new AppError(`${section} settings must be an object`, 400);
  }
  if (settings.run) {
    for (const key of ["environments", "platforms"]) if (settings.run[key] !== undefined && (!Array.isArray(settings.run[key]) || settings.run[key].length > 50 || settings.run[key].some((value: any) => typeof value !== "string" || !value.trim() || value.length > 100))) throw new AppError(`Run ${key} must contain up to 50 text values`, 400);
    for (const key of ["requireFailureReason", "requireFailureEvidence"]) if (settings.run[key] !== undefined && typeof settings.run[key] !== "boolean") throw new AppError(`Run ${key} must be a boolean`, 400);
  }
  if (settings.bugHandoff) {
    if (settings.bugHandoff.defaultListId !== undefined && settings.bugHandoff.defaultListId !== null && !mongoose.isValidObjectId(settings.bugHandoff.defaultListId)) throw new AppError("Bug handoff list is invalid", 400);
    if (settings.bugHandoff.copyRunContext !== undefined && typeof settings.bugHandoff.copyRunContext !== "boolean") throw new AppError("Bug handoff context setting must be a boolean", 400);
  }
  if (settings.notifications) for (const value of Object.values(settings.notifications)) if (typeof value !== "boolean") throw new AppError("Notification settings must be boolean values", 400);
  return settings;
};

const validateBugList = async (workspaceId: string, project: any, settings: any) => {
  const listId = settings?.bugHandoff?.defaultListId;
  if (!listId) return;
  const filter: any = { _id: listId, workspace: workspaceId, isDeleted: false };
  if (project.scopeType === "folder") filter.folderId = project.folder;
  if (!await List.exists(filter)) throw new AppError(project.scopeType === "folder" ? "Default bug list must be in this project's folder" : "Default bug list must belong to this workspace", 400);
};

export const listProjects = async (workspaceId: string, actorId: string) => {
  const { project: root } = await ensureWorkspaceProject(workspaceId, actorId);
  const projects = await QaProject.find({ workspace: workspaceId, isArchived: false }).populate("folder", "name spaceId").sort({ scopeType: 1, name: 1 }).lean();
  if (!projects.some((item: any) => item._id.toString() === root._id.toString())) projects.unshift(root);
  return projects;
};

export const createProject = async (workspaceId: string, actorId: string, input: any) => {
  await ensureWorkspaceProject(workspaceId, actorId);
  const folderId = input?.folderId;
  if (!folderId || !mongoose.isValidObjectId(folderId)) throw new AppError("Choose a folder for this QA project", 400);
  const folder = await Folder.findOne({ _id: folderId, isDeleted: false }).select("name spaceId").lean();
  if (!folder) throw new AppError("Folder not found", 404);
  const space = await Space.findOne({ _id: folder.spaceId, workspace: workspaceId, isDeleted: false }).select("_id").lean();
  if (!space) throw new AppError("Folder does not belong to this workspace", 400);
  const name = typeof input?.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : folder.name;
  try {
    return await QaProject.create({ workspace: workspaceId, folder: folderId, space: space._id, name, scopeType: "folder", settingsOverrides: {}, createdBy: actorId });
  } catch (error: any) {
    if (error?.code === 11000) throw new AppError("This folder already has a QA project", 409);
    throw error;
  }
};

export const getProjectSettings = async (workspaceId: string, projectId: string, actorId: string) => {
  const [{ project }, workspace] = await Promise.all([
    (async () => ({ project: await resolveProject(workspaceId, projectId, actorId) }))(),
    Workspace.findOne({ _id: workspaceId, isDeleted: false }).select("qualityDefaults").lean(),
  ]);
  return { project, settings: effectiveSettings(workspace, project) };
};

export const updateProjectSettings = async (workspaceId: string, projectId: string, actorId: string, input: any) => {
  const project = await resolveProject(workspaceId, projectId, actorId);
  if (input?.resetToWorkspaceDefaults === true) {
    await QaProject.updateOne({ _id: project._id, workspace: workspaceId }, { $set: { settingsOverrides: {} } });
    return getProjectSettings(workspaceId, project._id.toString(), actorId);
  }
  const settings = validateSettings(input);
  await validateBugList(workspaceId, project, settings);
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false }).select("qualityDefaults").lean();
  const workspaceDefaults = { ...cloneDefaults(), ...(workspace?.qualityDefaults || {}) };
  const nextOverrides = { ...(project.settingsOverrides || {}) };
  for (const [key, value] of Object.entries(settings)) {
    if (JSON.stringify(value) === JSON.stringify((workspaceDefaults as any)[key])) delete (nextOverrides as any)[key];
    else (nextOverrides as any)[key] = value;
  }
  const updated = await QaProject.findOneAndUpdate(
    { _id: project._id, workspace: workspaceId, isArchived: false },
    { $set: { settingsOverrides: nextOverrides } },
    { new: true, runValidators: true },
  ).lean();
  return getProjectSettings(workspaceId, updated._id.toString(), actorId);
};

export const getEffectiveSettings = async (workspaceId: string, projectId?: string, actorId?: string) => {
  const [{ project }, workspace] = await Promise.all([
    (async () => ({ project: await resolveProject(workspaceId, projectId, actorId) }))(),
    Workspace.findOne({ _id: workspaceId, isDeleted: false }).select("qualityDefaults").lean(),
  ]);
  return effectiveSettings(workspace, project);
};

export const validateCustomFields = (settings: any, customFields: any, currentFields: any = {}) => {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) throw new AppError("Custom fields must be an object", 400);
  const definitions = (settings.caseFields || []).filter((field: any) => field.enabled !== false && field.key !== "priority");
  const knownKeys = new Set([...definitions.map((field: any) => field.key), ...Object.keys(currentFields || {})]);
  for (const key of Object.keys(customFields)) if (!knownKeys.has(key)) throw new AppError(`Unknown case field: ${key}`, 400);
  const normalized: Record<string, any> = {};
  for (const field of definitions) {
    const value = customFields[field.key] ?? currentFields[field.key];
    if ((value === undefined || value === null || value === "") && field.required) throw new AppError(`${field.label} is required`, 400);
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "text" && (typeof value !== "string" || value.length > 4000)) throw new AppError(`${field.label} must be text up to 4000 characters`, 400);
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new AppError(`${field.label} must be a number`, 400);
    if (field.type === "checkbox" && typeof value !== "boolean") throw new AppError(`${field.label} must be checked or unchecked`, 400);
    if (field.type === "date" && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) throw new AppError(`${field.label} must be a valid date`, 400);
    if (field.type === "select" && (typeof value !== "string" || !field.options.includes(value))) throw new AppError(`${field.label} has an invalid option`, 400);
    if (field.type === "multiselect" && (!Array.isArray(value) || value.some((option: any) => !field.options.includes(option)))) throw new AppError(`${field.label} has an invalid option`, 400);
    normalized[field.key] = value;
  }
  // Disabled or retired fields remain on existing cases so a settings change
  // never silently destroys project data.
  for (const key of Object.keys(currentFields || {})) if (!(key in normalized) && !(key in customFields)) normalized[key] = currentFields[key];
  return normalized;
};

export const updateWorkspaceDefaults = async (workspaceId: string, actorId: string, input: any) => {
  const { project } = await ensureWorkspaceProject(workspaceId, actorId);
  const settings = validateSettings(input);
  await validateBugList(workspaceId, project, settings);
  const workspace = await Workspace.findOneAndUpdate(
    { _id: workspaceId, isDeleted: false },
    { $set: { qualityDefaults: settings } },
    { new: true, projection: "qualityDefaults" },
  ).lean();
  if (!workspace) throw new AppError("Workspace not found", 404);
  return { settings: effectiveSettings(workspace, null) };
};

export const DEFAULTS = DEFAULT_SETTINGS;
export { resolveProject, getProjectScope };
