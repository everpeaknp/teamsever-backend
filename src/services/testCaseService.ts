const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const QaModule = require("../models/QaModule");
const TestSuite = require("../models/TestSuite");
const TestCase = require("../models/TestCase");
const TestCaseRevision = require("../models/TestCaseRevision");
const QaProject = require("../models/QaProject");
const Task = require("../models/Task");
const List = require("../models/List");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

const text = (value: unknown, max: number, label: string, required = false): string | undefined => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(`${label} is required`, 400);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new AppError(`${label} must be 1–${max} characters`, 400);
  }
  return value.trim();
};

const objectId = (value: unknown, label: string): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if ((typeof value !== "string" && !(value instanceof mongoose.Types.ObjectId)) || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${label} is invalid`, 400);
  }
  return value.toString();
};

const choices = (value: unknown, allowed: string[], label: string, fallback: string): string => {
  const result = value === undefined ? fallback : value;
  if (typeof result !== "string" || !allowed.includes(result)) throw new AppError(`${label} is invalid`, 400);
  return result;
};

const checkEnabled = async (workspaceId: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  if (!workspace.qualityEnabled) throw new AppError("Quality is not enabled in this workspace", 403);
};

const normalizeSteps = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new AppError("A case needs 1–100 ordered steps", 400);
  }
  return value.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) throw new AppError(`Step ${index + 1} is invalid`, 400);
    return {
      action: text(step.action, 4000, `Step ${index + 1} action`, true),
      testData: text(step.testData, 4000, `Step ${index + 1} test data`),
      expectedResult: text(step.expectedResult, 4000, `Step ${index + 1} expected result`, true),
    };
  });
};

const normalizeCase = (input: any, current?: any, settings: any = qaProjectService.DEFAULTS) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("Case details are required", 400);
  const merged = { ...current, ...input };
  const linkedTaskIds = merged.linkedTaskIds === undefined ? [] : merged.linkedTaskIds;
  if (!Array.isArray(linkedTaskIds) || linkedTaskIds.length > 100) throw new AppError("Linked work items must be a list of at most 100 IDs", 400);
  const uniqueTaskIds = [...new Set(linkedTaskIds.map((id: unknown) => objectId(id, "Linked work item")))];
  const enabledTypes = (settings.caseTypes || []).filter((item: any) => item.enabled !== false);
  const statuses = settings.caseStatuses || [];
  return {
    title: text(merged.title, 240, "Title", true),
    moduleId: objectId(merged.moduleId, "Module"),
    suiteId: objectId(merged.suiteId, "Suite"),
    owner: objectId(merged.owner, "Owner"),
    priority: choices(merged.priority, ["low", "medium", "high", "urgent"], "Priority", "medium"),
    type: choices(merged.type, [...enabledTypes.map((item: any) => item.key), ...(current?.type ? [current.type] : [])], "Type", enabledTypes[0]?.key || "manual"),
    state: choices(merged.state, [...statuses.map((item: any) => item.key), ...(current?.state ? [current.state] : [])], "State", statuses[0]?.key || "draft"),
    customFields: qaProjectService.validateCustomFields(settings, merged.customFields || {}, current?.customFields || {}),
    preconditions: text(merged.preconditions, 8000, "Preconditions"),
    steps: normalizeSteps(merged.steps),
    linkedTaskIds: uniqueTaskIds,
  };
};

export const validateCaseDraft = (input: any, settings?: any) => normalizeCase(input, undefined, settings || qaProjectService.DEFAULTS);

const checkReferences = async (workspaceId: string, value: ReturnType<typeof normalizeCase>, projectScope: any) => {
  if (value.moduleId && !await QaModule.findOne({ _id: value.moduleId, workspace: workspaceId, ...projectScope.filter, isArchived: false })) {
    throw new AppError("Module is not available in this QA project", 400);
  }
  if (value.suiteId && !await TestSuite.findOne({ _id: value.suiteId, workspace: workspaceId, ...projectScope.filter, isArchived: false })) {
    throw new AppError("Suite is not available in this QA project", 400);
  }
  if (value.linkedTaskIds.length) {
    const filter: any = { _id: { $in: value.linkedTaskIds }, workspace: workspaceId, isDeleted: false };
    if (projectScope.project.scopeType === "folder") {
      const projectLists = await List.find({ workspace: workspaceId, folderId: projectScope.project.folder, isDeleted: false }).distinct("_id");
      filter.list = { $in: projectLists };
    }
    const count = await Task.countDocuments(filter);
    if (count !== value.linkedTaskIds.length) throw new AppError("Linked work item is not available in this workspace", 400);
  }
};

export const createCase = async (workspaceId: string, actorId: string, input: any) => {
  await checkEnabled(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, input.projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const details = normalizeCase(input, undefined, settings);
  await checkReferences(workspaceId, details, scope);
  const project = await QaProject.findOneAndUpdate(
    { _id: scope.project._id, workspace: workspaceId, isArchived: false },
    { $inc: { caseSequence: 1 } },
    { new: true, projection: "caseSequence" },
  );
  if (!project) throw new AppError("QA project not found", 404);
  const key = `TC-${String(project.caseSequence).padStart(3, "0")}`;
  const created = await TestCase.create({ ...details, workspace: workspaceId, project: scope.project._id, key, currentRevision: 1, createdBy: actorId, updatedBy: actorId });
  await TestCaseRevision.create({ workspace: workspaceId, project: scope.project._id, testCase: created._id, revision: 1, snapshot: { key, ...details }, actor: actorId });
  return created;
};

export const updateCase = async (workspaceId: string, caseId: string, actorId: string, expectedRevision: number, patch: any, projectId?: string) => {
  await checkEnabled(workspaceId);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new AppError("expectedRevision must be a positive integer", 400);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const current = await TestCase.findOne({ _id: caseId, workspace: workspaceId, ...scope.filter });
  if (!current) throw new AppError("Test case not found", 404);
  if (current.currentRevision !== expectedRevision) throw new AppError("Test case changed; reload and review your edits", 409);
  const currentData = current.toObject ? current.toObject() : current;
  const details = normalizeCase(patch, currentData, settings);
  if (details.state !== currentData.state && !(settings.caseTransitions?.[currentData.state] || []).includes(details.state)) throw new AppError(`Cannot move a case from ${currentData.state} to ${details.state}`, 409);
  await checkReferences(workspaceId, details, scope);
  const updated = await TestCase.findOneAndUpdate(
    { _id: caseId, workspace: workspaceId, ...scope.filter, currentRevision: expectedRevision },
    { $set: { ...details, updatedBy: actorId }, $inc: { currentRevision: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError("Test case changed; reload and review your edits", 409);
  await TestCaseRevision.create({ workspace: workspaceId, project: scope.project._id, testCase: caseId, revision: expectedRevision + 1, snapshot: { key: current.key, ...details }, actor: actorId });
  return updated;
};

export const listCases = async (workspaceId: string, raw: any = {}) => {
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const scope = await qaProjectService.getProjectScope(workspaceId, raw.projectId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString());
  const filter: any = { workspace: workspaceId, ...scope.filter };
  if (raw.state && (settings.caseStatuses || []).some((status: any) => status.key === raw.state)) filter.state = raw.state;
  if (raw.moduleId) filter.moduleId = objectId(raw.moduleId, "Module");
  if (raw.suiteId) filter.suiteId = objectId(raw.suiteId, "Suite");
  if (raw.search) {
    const search = text(raw.search, 120, "Search")!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ key: { $regex: search, $options: "i" } }, { title: { $regex: search, $options: "i" } }];
  }
  const [data, total] = await Promise.all([
    TestCase.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestCase.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};

export const getCase = async (workspaceId: string, caseId: string, projectId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const found = await TestCase.findOne({ _id: caseId, workspace: workspaceId, ...scope.filter }).lean();
  if (!found) throw new AppError("Test case not found", 404);
  return found;
};

export const getCaseRevision = async (workspaceId: string, caseId: string, revision: number, projectId?: string) => {
  if (!Number.isInteger(revision) || revision < 1) throw new AppError("Revision must be a positive integer", 400);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const found = await TestCaseRevision.findOne({ workspace: workspaceId, testCase: caseId, ...scope.filter, revision });
  if (!found) throw new AppError("Test case revision not found", 404);
  return found;
};

export const listCaseRevisions = async (workspaceId: string, caseId: string, projectId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const exists = await TestCase.exists({ _id: caseId, workspace: workspaceId, ...scope.filter });
  if (!exists) throw new AppError("Test case not found", 404);
  return TestCaseRevision.find({ workspace: workspaceId, testCase: caseId, ...scope.filter })
    .select("revision actor createdAt").sort({ revision: -1 }).lean();
};
