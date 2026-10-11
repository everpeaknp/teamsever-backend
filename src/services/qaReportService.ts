const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const Task = require("../models/Task");
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
    plan: { id: planId, name: plan.name },
    latestRun: runs[0] ? { id: runs[0]._id, build: runs[0].build, environment: runs[0].environment, platform: runs[0].platform, status: runs[0].status } : null,
    runIds,
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
  return QaReportSnapshot.create({ workspace: workspaceId, project: scope.project._id, plan: planId, report, signedBy: actorId, signedAt: new Date(), exceptionReason: exceptionReason || undefined });
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
  return { data, pagination: { page, limit, total } };
};

export const getSnapshot = async (workspaceId: string, snapshotId: string, projectId = "workspace", actorId?: string) => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const snapshot = await QaReportSnapshot.findOne({ _id: snapshotId, workspace: workspaceId, ...scope.filter }).lean();
  if (!snapshot) throw new AppError("Report snapshot not found", 404);
  return snapshot;
};
