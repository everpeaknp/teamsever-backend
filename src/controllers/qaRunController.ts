import { Request, Response } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/testRunService");
const defects = require("../services/qaDefectService");
const evidence = require("../services/qaEvidenceService");

export const listEligibleTesters = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listEligibleTesters(req.params.workspaceId) });
});

export const listEvidence = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await evidence.listEvidence(req.params.workspaceId, req.params.executionId, req.user!.id) });
});

export const uploadEvidence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await evidence.uploadEvidence(req.params.workspaceId, req.params.executionId, req.user!.id, req.file);
  res.status(201).json({ success: true, data });
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...await service.listPlans(req.params.workspaceId, req.query.page, req.query.limit, String(req.query.projectId || "workspace")) });
});

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getPlan(req.params.workspaceId, req.params.planId, String(req.query.projectId || "workspace")) });
});

export const createPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ success: true, data: await service.createPlan(req.params.workspaceId, req.user!.id, { ...req.body, projectId: req.query.projectId || req.body?.projectId || "workspace" }) });
});

export const startRun = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(201).json({ success: true, data: await service.startRun(req.params.workspaceId, req.params.planId, req.user!.id, req.body, String(req.query.projectId || "workspace")) });
});

export const listRuns = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...await service.listRuns(req.params.workspaceId, req.query) });
});

export const listExecutions = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...await service.listExecutions(req.params.workspaceId, req.params.runId, req.query) });
});

export const listMyExecutions = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, ...await service.listMyExecutions(req.params.workspaceId, req.user!.id, req.query) });
});

export const getExecution = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await service.getExecution(req.params.workspaceId, req.params.executionId, req.user!.id, String(req.query.projectId || "workspace")) });
});

export const recordExecution = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await service.recordExecution(req.params.workspaceId, req.params.executionId, req.user!.id, req.body, String(req.query.projectId || "workspace")) });
});

export const closeRun = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await service.closeRun(req.params.workspaceId, req.params.runId, req.user!.id, String(req.query.projectId || "workspace")) });
});

export const createOrLinkBug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await defects.createOrLinkBug(req.params.workspaceId, req.params.executionId, req.user!.id, req.body, String(req.query.projectId || "workspace"));
  res.status(201).json({ success: true, data });
});
