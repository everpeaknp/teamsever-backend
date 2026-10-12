const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const TestCase = require("../models/TestCase");
const Task = require("../models/Task");
const User = require("../models/User");
const Attachment = require("../models/Attachment");
const PermissionService = require("../permissions/permission.service");
const QaReportSnapshot = require("../models/QaReportSnapshot");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

const ratio = (numerator: number, denominator: number) => ({ numerator, denominator, percent: denominator ? Math.round(numerator / denominator * 100) : null });

export const getLiveReport = async (workspaceId: string, planId: string, projectId = "workspace", actorId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const plan = await TestPlan.findOne({ _id: planId, workspace: workspaceId, ...scope.filter });
  if (!plan) throw new AppError("Test plan not found", 404);
  const runs = await TestRun.find({ workspace: workspaceId, ...scope.filter, plan: planId }).sort({ createdAt: -1, _id: -1 }).select("_id build environment platform status createdAt").lean();
  const runIds = runs.map((run: any) => run._id);
  const latestRun = runs[0];
  const executions = latestRun ? await TestExecution.find({
    workspace: workspaceId,
    ...scope.filter,
    run: latestRun._id,
    testCase: { $in: plan.caseIds },
  }).select("testCase caseKey revision snapshot assignedTo lastUpdatedBy result reason stepResults evidenceIds bugIds updatedAt").lean() : [];
  const executionByCase = new Map(executions.map((execution: any) => [String(execution.testCase), execution]));
  const missingCaseIds = plan.caseIds.filter((id: any) => !executionByCase.has(String(id)));
  const missingCases = missingCaseIds.length ? await TestCase.find({
    workspace: workspaceId,
    ...scope.filter,
    _id: { $in: missingCaseIds },
  }).select("_id key title currentRevision steps").lean() : [];
  const caseById = new Map(missingCases.map((testCase: any) => [String(testCase._id), testCase]));
  const bugIds = [...new Set(executions.flatMap((execution: any) => (execution.bugIds || []).map((id: any) => String(id))))];
  const bugs = bugIds.length ? await Task.find({
    _id: { $in: bugIds }, workspace: workspaceId, qaProject: scope.project._id,
    workItemType: "bug", isDeleted: false,
  }).select("_id title status priority assignee bugHistory list space").lean() : [];
  const visibleBugs = await Promise.all(bugs.map(async (bug: any) => {
    const allowed = !actorId || await PermissionService.can(actorId, "VIEW_TASK", {
      workspaceId, userId: actorId, listId: String(bug.list), spaceId: String(bug.space),
      resourceType: "task", resourceId: String(bug._id),
    });
    return allowed ? bug : null;
  }));
  const visibleBugById = new Map(visibleBugs.filter(Boolean).map((bug: any) => [String(bug._id), bug]));
  const visibleBugIds = new Set(visibleBugById.keys());
  const evidenceIds = [...new Set(executions.flatMap((execution: any) => [
    ...(execution.evidenceIds || []),
    ...(execution.stepResults || []).flatMap((step: any) => step.evidenceIds || []),
  ].map((id: any) => String(id))))];
  const evidence = evidenceIds.length ? await Attachment.find({ _id: { $in: evidenceIds }, workspace: workspaceId, isDeleted: false })
    .select("_id originalName mimeType size").lean() : [];
  const userIds = [...new Set([
    ...executions.flatMap((execution: any) => [execution.lastUpdatedBy, execution.assignedTo]),
    ...bugs.flatMap((bug: any) => [bug.assignee, ...(bug.bugHistory || []).map((entry: any) => entry.actor)]),
  ].filter(Boolean).map((id: any) => String(id)))];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select("_id name email").lean() : [];
  const userById = new Map<string, any>(users.map((user: any) => [String(user._id), user]));
  const evidenceById = new Map(evidence.map((file: any) => [String(file._id), file]));
  const bugById = visibleBugById;
  const cases = plan.caseIds.map((caseId: any) => {
    const execution: any = executionByCase.get(String(caseId));
    const testCase: any = caseById.get(String(caseId));
    const snapshot = execution?.snapshot || testCase || {};
    const steps = snapshot.steps || [];
    const stepResults = execution?.stepResults || [];
    const linkedBugs = (execution?.bugIds || []).map((id: any) => bugById.get(String(id))).filter(Boolean).map((bug: any) => {
      const history = bug.bugHistory || [];
      const latestTransition = history[history.length - 1];
      const verification = latestTransition?.action === "verify" && bug.status === "done" ? latestTransition : null;
      const assigneeId = bug.assignee ? String(bug.assignee) : "";
      return {
        id: String(bug._id), title: bug.title, status: bug.status, priority: bug.priority,
        assignee: userById.get(assigneeId)?.name || null,
        verification: verification ? {
          status: "verified", note: verification.reason || "", verifiedAt: verification.at || null,
          verifiedBy: userById.get(String(verification.actor))?.name || null,
      } : { status: "not_verified" },
      };
    });
    const allEvidenceIds = [...new Set([
      ...(execution?.evidenceIds || []), ...stepResults.flatMap((step: any) => step.evidenceIds || []),
    ].map((id: any) => String(id)))];
    const testerId = execution?.lastUpdatedBy ? String(execution.lastUpdatedBy) : "";
    const assignedId = execution?.assignedTo ? String(execution.assignedTo) : "";
    return {
      id: String(caseId), key: execution?.caseKey || testCase?.key || "—",
      title: snapshot.title || testCase?.title || "Case details unavailable",
      revision: execution?.revision || testCase?.currentRevision || null,
      result: execution?.result || "not_run",
      tester: userById.get(testerId)?.name || null,
      assignee: userById.get(assignedId)?.name || null,
      updatedAt: execution?.updatedAt || null,
      reason: execution?.reason || "",
      steps: steps.map((step: any, index: number) => ({
        number: index + 1, action: step.action, testData: step.testData || "", expectedResult: step.expectedResult,
        actualResult: stepResults[index]?.actualResult || "", result: stepResults[index]?.result || "not_run",
      })),
      evidence: allEvidenceIds.map(id => evidenceById.get(id)).filter(Boolean).map((file: any) => ({
        name: file.originalName, mimeType: file.mimeType, size: file.size,
      })),
      linkedBugs,
      hiddenLinkedBugCount: (execution?.bugIds || []).filter((id: any) => !visibleBugIds.has(String(id))).length,
    };
  });
  const groups = runIds.length ? await TestExecution.aggregate([
    { $match: { workspace: plan.workspace, ...scope.filter, run: runIds[0], testCase: { $in: plan.caseIds } } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$testCase", result: { $first: "$result" } } },
    { $group: { _id: "$result", count: { $sum: 1 } } },
    { $project: { _id: 0, result: "$_id", count: 1 } },
  ]) : [];
  const selected = plan.caseIds.length;
  const byResult = Object.fromEntries(groups.map((group: any) => [group.result, group.count]));
  const pass = Number(byResult.pass || 0);
  const fail = Number(byResult.fail || 0);
  const blocked = Number(byResult.blocked || 0);
  const skipped = Number(byResult.skipped || 0);
  const notRun = Math.max(0, selected - pass - fail - blocked - skipped);
  const unresolvedHighBugs = await Task.countDocuments({ workspace: workspaceId, qaProject: scope.project._id, workItemType: "bug", isDeleted: false, priority: { $in: ["high", "urgent"] }, status: { $nin: ["done", "cancelled"] } });
  const blockers = fail + blocked + notRun + unresolvedHighBugs + (runs[0]?.status === "open" ? 1 : 0);
  return {
    plan: { id: planId, name: plan.name, description: plan.description || "" },
    latestRun: latestRun ? { id: latestRun._id, build: latestRun.build, environment: latestRun.environment, platform: latestRun.platform, status: latestRun.status, startedAt: latestRun.createdAt } : null,
    runIds,
    cases,
    counts: { selected, pass, fail, blocked, skipped, notRun },
    completion: ratio(pass + fail + blocked + skipped, selected),
    passRate: ratio(pass, pass + fail),
    gate: { ready: blockers === 0, unresolvedHighBugs, blockers },
    generatedAt: new Date(),
  };
};

export const signOffPlan = async (workspaceId: string, planId: string, actorId: string, rawExceptionReason?: unknown, projectId = "workspace") => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const report = await getLiveReport(workspaceId, planId, projectId, actorId);
  if (!report.latestRun || !report.counts.selected) throw new AppError("Start a run with selected cases before signoff", 400);
  if (rawExceptionReason !== undefined && typeof rawExceptionReason !== "string") throw new AppError("Exception reason must be text", 400);
  const exceptionReason = typeof rawExceptionReason === "string" ? rawExceptionReason.trim() : "";
  if (exceptionReason.length > 4000) throw new AppError("Exception reason is too long", 400);
  if (!report.gate.ready && !exceptionReason) throw new AppError("Resolve blockers or record an exception reason before signoff", 400);
  const snapshot = await QaReportSnapshot.create({ workspace: workspaceId, project: scope.project._id, plan: planId, report, signedBy: actorId, signedAt: new Date(), exceptionReason: exceptionReason || undefined });
  const signer = await User.findById(actorId).select("name").lean();
  return { ...(typeof snapshot?.toObject === "function" ? snapshot.toObject() : snapshot), signedByName: signer?.name || null };
};

export const listSnapshots = async (workspaceId: string, raw: any = {}) => {
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(raw.limit) || 30)));
  const scope = await qaProjectService.getProjectScope(workspaceId, raw.projectId, raw.actorId);
  const filter: any = { workspace: workspaceId, ...scope.filter };
  if (raw.planId) filter.plan = raw.planId;
  const [data, total] = await Promise.all([
    QaReportSnapshot.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QaReportSnapshot.countDocuments(filter),
  ]);
  const signerIds = [...new Set(data.map((snapshot: any) => String(snapshot.signedBy)))];
  const signers = signerIds.length ? await User.find({ _id: { $in: signerIds } }).select("_id name").lean() : [];
  const signerById = new Map(signers.map((signer: any) => [String(signer._id), signer.name]));
  return { data: data.map((snapshot: any) => ({ ...snapshot, signedByName: signerById.get(String(snapshot.signedBy)) || null })), pagination: { page, limit, total } };
};

export const getSnapshot = async (workspaceId: string, snapshotId: string, projectId = "workspace", actorId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const snapshot = await QaReportSnapshot.findOne({ _id: snapshotId, workspace: workspaceId, ...scope.filter }).lean();
  if (!snapshot) throw new AppError("Report snapshot not found", 404);
  const signer = await User.findById(snapshot.signedBy).select("name email").lean();
  return { ...snapshot, signedByName: signer?.name || null };
};
