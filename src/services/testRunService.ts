const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const TestCase = require("../models/TestCase");
const TestCaseRevision = require("../models/TestCaseRevision");
const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const Attachment = require("../models/Attachment");
const PermissionService = require("../permissions/permission.service");
const AppError = require("../utils/AppError");
const notifications = require("./enhancedNotificationService");
const qaProjectService = require("./qaProjectService");

const safeText = (value: unknown, max: number, label: string, required = false): string | undefined => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(`${label} is required`, 400);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new AppError(`${label} must be 1–${max} characters`, 400);
  return value.trim();
};

const uniqueIds = (value: unknown, label: string, max: number, required = false): string[] => {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || (required && !value.length) || value.length > max) throw new AppError(`${label} must contain ${required ? "1–" : "at most "}${max} IDs`, 400);
  const ids = value.map(id => {
    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) throw new AppError(`${label} contains an invalid ID`, 400);
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new AppError(`${label} contains duplicate IDs`, 400);
  return ids;
};

const enabledWorkspace = async (workspaceId: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  if (!workspace.qualityEnabled) throw new AppError("Quality is not enabled in this workspace", 403);
  return workspace;
};

const isWorkspaceMember = (workspace: any, userId: string) =>
  workspace.owner?.toString() === userId ||
  workspace.members?.some((member: any) => member.user?.toString() === userId);

export const listEligibleTesters = async (workspaceId: string) => {
  const workspace = await enabledWorkspace(workspaceId);
  const ids = [...new Set([
    workspace.owner?.toString(),
    ...(workspace.members || []).map((member: any) => member.user?.toString()),
  ].filter(Boolean))] as string[];
  const allowed = await Promise.all(ids.map(async userId => ({
    userId,
    canExecute: await PermissionService.can(userId, "QA_EXECUTE", { workspaceId, userId }),
  })));
  const eligibleIds = allowed.filter(item => item.canExecute).map(item => item.userId);
  if (!eligibleIds.length) return [];
  return User.find({ _id: { $in: eligibleIds } }).select("_id name email").sort({ name: 1, _id: 1 }).lean();
};

export const createPlan = async (workspaceId: string, actorId: string, input: any) => {
  await enabledWorkspace(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, input?.projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const terminalStates = settings.caseStatuses.filter((item: any) => item.terminal).map((item: any) => item.key);
  const name = safeText(input?.name, 160, "Plan name", true);
  const description = safeText(input?.description, 4000, "Description");
  const caseIds = uniqueIds(input?.caseIds, "Cases", 1000, true);
  const count = await TestCase.countDocuments({ _id: { $in: caseIds }, workspace: workspaceId, ...scope.filter, state: { $nin: terminalStates } });
  if (count !== caseIds.length) throw new AppError("A selected case is not available in this QA project", 400);
  return TestPlan.create({ workspace: workspaceId, project: scope.project._id, name, description, caseIds, status: "draft", createdBy: actorId, updatedBy: actorId });
};

export const listPlans = async (workspaceId: string, rawPage = 1, rawLimit = 30, projectId?: string) => {
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 30)));
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const filter = { workspace: workspaceId, ...scope.filter, status: { $ne: "archived" } };
  const [data, total] = await Promise.all([
    TestPlan.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestPlan.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};

export const getPlan = async (workspaceId: string, planId: string, projectId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const plan = await TestPlan.findOne({ _id: planId, workspace: workspaceId, ...scope.filter }).lean();
  if (!plan) throw new AppError("Test plan not found", 404);
  const cases = await TestCase.find({ _id: { $in: plan.caseIds }, workspace: workspaceId, ...scope.filter })
    .select("_id key title owner state").lean();
  const byId = new Map(cases.map((testCase: any) => [testCase._id.toString(), testCase]));
  return { ...plan, cases: plan.caseIds.map((id: any) => byId.get(id.toString())).filter(Boolean) };
};

export const startRun = async (workspaceId: string, planId: string, actorId: string, input: any, projectId?: string) => {
  const workspace = await enabledWorkspace(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId || input?.projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const terminalStates = settings.caseStatuses.filter((item: any) => item.terminal).map((item: any) => item.key);
  const build = safeText(input?.build, 120, "Build", true);
  const environment = safeText(input?.environment, 240, "Environment", true);
  const platform = safeText(input?.platform, 120, "Platform");
  if (settings.run.environments.length && !settings.run.environments.includes(environment)) throw new AppError("Choose a configured test environment", 400);
  if (settings.run.platforms.length && (!platform || !settings.run.platforms.includes(platform))) throw new AppError("Choose a configured test platform", 400);
  const plan = await TestPlan.findOne({ _id: planId, workspace: workspaceId, ...scope.filter, status: { $ne: "archived" } });
  if (!plan) throw new AppError("Test plan not found", 404);
  const caseIds = plan.caseIds.map((id: any) => id.toString());
  if (!caseIds.length) throw new AppError("Add cases to this plan before starting a run", 400);
  const cases = await TestCase.find({ _id: { $in: caseIds }, workspace: workspaceId, ...scope.filter, state: { $nin: terminalStates } });
  if (cases.length !== caseIds.length) throw new AppError("A selected case is no longer available", 409);
  const revisionPairs = cases.map((testCase: any) => ({ testCase: testCase._id, revision: testCase.currentRevision }));
  const revisions = await TestCaseRevision.find({ workspace: workspaceId, ...scope.filter, $or: revisionPairs });
  if (revisions.length !== caseIds.length) throw new AppError("A selected case revision is unavailable", 409);
  const assigned = input?.assignments || {};
  if (typeof assigned !== "object" || Array.isArray(assigned)) throw new AppError("Assignments must map case IDs to testers", 400);
  for (const [id, userId] of Object.entries(assigned)) {
    if (!caseIds.includes(id) || typeof userId !== "string" || !mongoose.isValidObjectId(userId)) throw new AppError("Assignment contains an invalid case or tester", 400);
    if (!isWorkspaceMember(workspace, userId)) {
      throw new AppError("Assigned tester is not a workspace member", 400);
    }
  }
  const resolvedTesters = cases.map((testCase: any) => assigned[testCase._id.toString()] || testCase.owner?.toString()).filter(Boolean);
  for (const userId of new Set(resolvedTesters as string[])) {
    if (!isWorkspaceMember(workspace, userId)) {
      throw new AppError("Assigned tester is not a workspace member", 400);
    }
    if (!await PermissionService.can(userId, "QA_EXECUTE", { workspaceId, userId })) {
      throw new AppError("Assigned tester cannot execute cases in this workspace", 403);
    }
  }
  const run = await TestRun.create({ workspace: workspaceId, project: scope.project._id, plan: planId, build, environment, platform, status: "open", startedBy: actorId });
  const rows = cases.map((testCase: any) => {
    const revision = revisions.find((entry: any) => entry.testCase.toString() === testCase._id.toString() && entry.revision === testCase.currentRevision);
    return { workspace: workspaceId, project: scope.project._id, run: run._id, testCase: testCase._id, caseKey: testCase.key, revision: testCase.currentRevision, revisionId: revision._id, snapshot: revision.snapshot, assignedTo: assigned[testCase._id.toString()] || testCase.owner, result: "not_run", version: 1 };
  });
  try {
    await TestExecution.insertMany(rows, { ordered: true });
  } catch (error) {
    await TestExecution.deleteMany({ workspace: workspaceId, run: run._id });
    await TestRun.deleteOne({ _id: run._id, workspace: workspaceId });
    throw error;
  }
  const testers = [...new Set(rows.map((row: any) => row.assignedTo?.toString()).filter(Boolean))]
    .filter((userId: string) => userId !== actorId);
  await Promise.allSettled(settings.notifications.runAssigned ? testers.map((recipientId: string) => notifications.createNotification({
    recipientId,
    type: "QA_RUN_ASSIGNED",
    title: "Test run assigned",
    body: `${plan.name}: ${build} · ${environment}`,
    data: { workspaceId, runId: run._id.toString(), resourceId: run._id.toString(), resourceType: "TestRun" },
  })) : []);
  return run;
};

export const listRuns = async (workspaceId: string, raw: any = {}) => {
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const scope = await qaProjectService.getProjectScope(workspaceId, raw.projectId);
  const filter: any = { workspace: workspaceId, ...scope.filter };
  if (raw.planId) filter.plan = raw.planId;
  if (raw.status && ["open", "closed"].includes(raw.status)) filter.status = raw.status;
  const [data, total] = await Promise.all([
    TestRun.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestRun.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};

export const listExecutions = async (workspaceId: string, runId: string, raw: any = {}, actorId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, raw.projectId);
  const run = await TestRun.findOne({ _id: runId, workspace: workspaceId, ...scope.filter });
  if (!run) throw new AppError("Test run not found", 404);
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const filter: any = { workspace: workspaceId, ...scope.filter, run: runId };
  if (raw.result && ["not_run", "pass", "fail", "blocked", "skipped"].includes(raw.result)) filter.result = raw.result;
  if (raw.assignedTo) filter.assignedTo = raw.assignedTo;
  const [data, total] = await Promise.all([
    TestExecution.find(filter).sort({ caseKey: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestExecution.countDocuments(filter),
  ]);
  const bugIds = [...new Set(data.flatMap((execution: any) => execution.bugIds || []).map((id: any) => id.toString()))];
  const Task = require("../models/Task");
  const bugs = bugIds.length ? await Task.find({ _id: { $in: bugIds }, workspace: workspaceId, qaProject: scope.project._id, workItemType: "bug", isDeleted: false })
    .select("title status priority bugDetails list assignee dueDate")
    .populate({ path: "list", select: "name space", populate: { path: "space", select: "name" } })
    .populate("assignee", "name email")
    .lean() : [];
  const visibleBugs = await Promise.all(bugs.map(async (bug: any) => {
    const listId = bug.list?._id?.toString() || bug.list?.toString();
    const spaceId = bug.list?.space?._id?.toString() || bug.list?.space?.toString();
    const allowed = !actorId || await PermissionService.can(actorId, "VIEW_TASK", { workspaceId, userId: actorId, listId, spaceId, resourceType: "task", resourceId: bug._id.toString() });
    return allowed ? bug : null;
  }));
  const visibleById = new Map(visibleBugs.filter(Boolean).map((bug: any) => [bug._id.toString(), bug]));
  const enriched = data.map((execution: any) => ({ ...execution, linkedBugs: (execution.bugIds || []).map((id: any) => visibleById.get(id.toString())).filter(Boolean) }));
  return { data: enriched, pagination: { page, limit, total }, run };
};

export const listMyExecutions = async (workspaceId: string, actorId: string, raw: any = {}) => {
  await enabledWorkspace(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, raw.projectId, actorId);
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const filter: any = { workspace: workspaceId, ...scope.filter, assignedTo: actorId };
  if (raw.result && ["not_run", "pass", "fail", "blocked", "skipped"].includes(raw.result)) filter.result = raw.result;
  const [data, total] = await Promise.all([
    TestExecution.find(filter).populate("run", "build environment status").sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestExecution.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total } };
};

export const getExecution = async (workspaceId: string, executionId: string, actorId: string, projectId?: string) => {
  await enabledWorkspace(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const execution = await TestExecution.findOne({ _id: executionId, workspace: workspaceId, ...scope.filter }).populate("run", "build environment status").lean();
  if (!execution) throw new AppError("Execution not found", 404);
  if (execution.assignedTo?.toString() !== actorId &&
      !await PermissionService.can(actorId, "QA_MANAGE_RELEASES", { workspaceId, userId: actorId })) {
    throw new AppError("This execution is assigned to another tester", 403);
  }
  return execution;
};

export const recordExecution = async (workspaceId: string, executionId: string, actorId: string, input: any, projectId?: string) => {
  await enabledWorkspace(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  if (!Number.isInteger(input?.expectedVersion) || input.expectedVersion < 1) throw new AppError("expectedVersion must be a positive integer", 400);
  const execution = await TestExecution.findOne({ _id: executionId, workspace: workspaceId, ...scope.filter });
  if (!execution) throw new AppError("Execution not found", 404);
  if (execution.version !== input.expectedVersion) throw new AppError("Execution changed; reload before saving", 409);
  if (execution.assignedTo && execution.assignedTo.toString() !== actorId &&
      !await PermissionService.can(actorId, "QA_MANAGE_RELEASES", { workspaceId, userId: actorId })) {
    throw new AppError("This execution is assigned to another tester", 403);
  }
  if (execution.run) {
    const run = await TestRun.findOne({ _id: execution.run, workspace: workspaceId, ...scope.filter });
    if (!run) throw new AppError("Test run not found", 404);
    if (run.status !== "open") throw new AppError("This run is closed", 409);
  }
  const result = input.result;
  const allowed = ["not_run", "pass", "fail", "blocked", "skipped"];
  if (!allowed.includes(result)) throw new AppError("Invalid execution result", 400);
  const reason = safeText(input.reason, 4000, "Result reason");
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  if (["fail", "blocked"].includes(result) && settings.run.requireFailureReason && !reason) throw new AppError("A reason is required for Fail or Blocked", 400);
  const stepResults = input.stepResults;
  if (!Array.isArray(stepResults) || stepResults.length !== execution.snapshot.steps.length) throw new AppError("Provide a result for every case step", 400);
  const normalizedSteps = stepResults.map((step: any) => {
    if (!step || !allowed.includes(step.result)) throw new AppError("Invalid step result", 400);
    return { result: step.result, actualResult: safeText(step.actualResult, 4000, "Step actual result"), evidenceIds: uniqueIds(step.evidenceIds, "Step evidence", 20) };
  });
  if (result === "pass" && normalizedSteps.some((step: any) => step.result !== "pass")) {
    throw new AppError("Every step must pass before the case can pass", 400);
  }
  const evidenceIds = uniqueIds(input.evidenceIds, "Evidence", 30);
  const allEvidenceIds = [...new Set([...evidenceIds, ...normalizedSteps.flatMap((step: any) => step.evidenceIds)])];
  if (["fail", "blocked"].includes(result) && settings.run.requireFailureEvidence && !allEvidenceIds.length) throw new AppError("Attach evidence before recording a failed or blocked result", 400);
  if (allEvidenceIds.length) {
    const count = await Attachment.countDocuments({ _id: { $in: allEvidenceIds }, workspace: workspaceId, execution: executionId, uploadedBy: actorId, isDeleted: false });
    if (count !== allEvidenceIds.length) throw new AppError("Evidence is not owned by you in this workspace", 400);
  }
  const history = { version: input.expectedVersion + 1, previousResult: execution.result, result, reason, stepResults: normalizedSteps, evidenceIds, actor: actorId, at: new Date() };
  const updated = await TestExecution.findOneAndUpdate(
    { _id: executionId, workspace: workspaceId, ...scope.filter, version: input.expectedVersion },
    { $set: { result, reason, stepResults: normalizedSteps, evidenceIds, lastUpdatedBy: actorId }, $inc: { version: 1 }, $push: { history } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError("Execution changed; reload before saving", 409);
  if (result === "fail" && settings.notifications.failureRecorded && execution.run) {
    const run = await TestRun.findOne({ _id: execution.run, workspace: workspaceId, ...scope.filter }).select("startedBy build environment").lean();
    const ownerId = run?.startedBy?.toString();
    if (ownerId && ownerId !== actorId) await notifications.createNotification({
      recipientId: ownerId, type: "QA_FAILURE_RECORDED", title: "Test case failed",
      body: `${execution.caseKey}: ${reason || "Failure recorded"}`,
      data: { workspaceId, projectId: scope.project._id.toString(), executionId, runId: execution.run.toString(), resourceId: execution.run.toString(), resourceType: "TestRun" },
    });
  }
  return updated;
};

export const closeRun = async (workspaceId: string, runId: string, actorId: string, projectId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const run = await TestRun.findOneAndUpdate(
    { _id: runId, workspace: workspaceId, ...scope.filter, status: "open" },
    { $set: { status: "closed", closedBy: actorId, closedAt: new Date() } },
    { new: true },
  );
  if (!run) throw new AppError("Open test run not found", 404);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  if (settings.notifications.runClosed && run.startedBy?.toString() !== actorId) {
    await notifications.createNotification({ recipientId: run.startedBy.toString(), type: "QA_RUN_CLOSED", title: "Test run closed", body: `${run.build} · ${run.environment}`, data: { workspaceId, projectId: scope.project._id.toString(), runId: run._id.toString(), resourceId: run._id.toString(), resourceType: "TestRun" } });
  }
  return run;
};
