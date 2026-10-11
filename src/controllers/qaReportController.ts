import { Request, Response } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const reports = require("../services/qaReportService");

export const getLive = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (typeof req.query.planId !== "string") throw new AppError("planId is required", 400);
  res.json({ success: true, data: await reports.getLiveReport(req.params.workspaceId, req.query.planId, String(req.query.projectId || "workspace"), req.user!.id) });
});

export const signOff = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await reports.signOffPlan(req.params.workspaceId, req.params.planId, req.user!.id, req.body?.exceptionReason, String(req.query.projectId || "workspace"));
  res.status(201).json({ success: true, data });
});

export const listSnapshots = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, ...await reports.listSnapshots(req.params.workspaceId, { ...req.query, actorId: req.user!.id }) });
});

export const getSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await reports.getSnapshot(req.params.workspaceId, req.params.snapshotId, String(req.query.projectId || "workspace"), req.user!.id) });
});

const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export const exportSnapshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const snapshot = await reports.getSnapshot(req.params.workspaceId, req.params.snapshotId, String(req.query.projectId || "workspace"), req.user!.id);
  const r = snapshot.report;
  const rows = [
    ["Plan", r.plan.name], ["Signed at", snapshot.signedAt], ["Signed by", snapshot.signedBy],
    ["Build", r.latestRun?.build], ["Environment", r.latestRun?.environment],
    ["Selected", r.counts.selected], ["Pass", r.counts.pass], ["Fail", r.counts.fail],
    ["Blocked", r.counts.blocked], ["Skipped", r.counts.skipped], ["Not run", r.counts.notRun],
    ["Completion numerator", r.completion.numerator], ["Completion denominator", r.completion.denominator],
    ["Pass numerator", r.passRate.numerator], ["Pass denominator", r.passRate.denominator],
    ["Release ready", r.gate.ready], ["Unresolved high bugs", r.gate.unresolvedHighBugs],
    ["Exception reason", snapshot.exceptionReason],
  ];
  res.type("text/csv; charset=utf-8");
  res.attachment(`qa-report-${req.params.snapshotId}.csv`);
  res.send(`\uFEFF${["Metric,Value", ...rows.map(row => row.map(csv).join(","))].join("\r\n")}`);
});
