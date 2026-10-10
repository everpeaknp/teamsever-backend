import { Request, Response } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const Workspace = require("../models/Workspace");
const QaModule = require("../models/QaModule");
const TestSuite = require("../models/TestSuite");
const service = require("../services/testCaseService");
const bugQueue = require("../services/qaBugQueueService");
const importService = require("../services/testCaseImportService");

export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Choose a CSV or XLSX file", 400);
  const data = await importService.previewCaseImport(req.params.workspaceId, req.user!.id, req.file);
  res.json({ success: true, data });
});

export const commitImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await importService.commitCaseImport(req.params.workspaceId, req.user!.id, req.body?.previewToken, req.body?.mode);
  res.json({ success: true, data });
});

export const exportCases = asyncHandler(async (req: Request, res: Response) => {
  const buffer = await importService.exportCases(req.params.workspaceId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=quality-cases.xlsx");
  res.send(buffer);
});

export const listBugs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await bugQueue.listBugs(req.params.workspaceId, req.user!.id, req.query);
  res.json({ success: true, ...result });
});

export const listSuites = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 30)));
  const filter = { workspace: req.params.workspaceId, isArchived: false };
  const [data, total] = await Promise.all([
    TestSuite.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    TestSuite.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total } });
});

export const createSuite = asyncHandler(async (req: AuthRequest, res: Response) => {
  const workspaceId = req.params.workspaceId;
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  if (!workspace.qualityEnabled) throw new AppError("Quality is not enabled in this workspace", 403);
  const name = req.body?.name?.trim();
  if (typeof name !== "string" || !name || name.length > 120) throw new AppError("Suite name must be 1–120 characters", 400);
  const moduleId = req.body?.moduleId;
  if (moduleId && !await QaModule.findOne({ _id: moduleId, workspace: workspaceId, isArchived: false })) {
    throw new AppError("Module is not available in this workspace", 400);
  }
  const description = req.body?.description;
  if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
    throw new AppError("Suite description is too long", 400);
  }
  const data = await TestSuite.create({ workspace: workspaceId, moduleId, name, description, createdBy: req.user!.id });
  res.status(201).json({ success: true, data });
});

export const archiveSuite = asyncHandler(async (req: Request, res: Response) => {
  const data = await TestSuite.findOneAndUpdate(
    { _id: req.params.suiteId, workspace: req.params.workspaceId, isArchived: false },
    { $set: { isArchived: true } }, { new: true },
  );
  if (!data) throw new AppError("Suite not found", 404);
  res.json({ success: true, data });
});

export const listCases = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listCases(req.params.workspaceId, req.query);
  res.json({ success: true, ...result });
});

export const getCase = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCase(req.params.workspaceId, req.params.caseId);
  res.json({ success: true, data });
});

export const createCase = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await service.createCase(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data });
});

export const updateCase = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { expectedRevision, ...patch } = req.body || {};
  const data = await service.updateCase(req.params.workspaceId, req.params.caseId, req.user!.id, Number(expectedRevision), patch);
  res.json({ success: true, data });
});

export const listCaseRevisions = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listCaseRevisions(req.params.workspaceId, req.params.caseId);
  res.json({ success: true, data });
});

export const getCaseRevision = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCaseRevision(req.params.workspaceId, req.params.caseId, Number(req.params.revision));
  res.json({ success: true, data });
});
