import { Request, Response } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const qaModuleService = require("../services/qaModuleService");
const qaCapabilityService = require("../services/qaCapabilityService");
const qaProjectService = require("../services/qaProjectService");

export const listProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await qaProjectService.listProjects(req.params.workspaceId, req.user!.id) });
});

export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaProjectService.createProject(req.params.workspaceId, req.user!.id, req.body);
  res.status(201).json({ success: true, data });
});

export const getProjectSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaProjectService.getProjectSettings(req.params.workspaceId, String(req.query.projectId || "workspace"), req.user!.id);
  res.json({ success: true, data });
});

export const updateProjectSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaProjectService.updateProjectSettings(req.params.workspaceId, String(req.query.projectId || "workspace"), req.user!.id, req.body);
  res.json({ success: true, data });
});

export const updateWorkspaceDefaults = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaProjectService.updateWorkspaceDefaults(req.params.workspaceId, req.user!.id, req.body);
  res.json({ success: true, data });
});

export const getCapabilities = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaCapabilityService.getCapabilities(
    req.params.workspaceId,
    req.user!.id,
    typeof req.query.listId === "string" ? req.query.listId : undefined,
    typeof req.query.projectId === "string" ? req.query.projectId : undefined,
  );
  res.json({ success: true, data });
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const workspace = await Workspace.findOne({ _id: req.params.workspaceId, isDeleted: false })
    .select("qualityEnabled").lean();
  if (!workspace) throw new AppError("Workspace not found", 404);
  res.json({ success: true, data: { qualityEnabled: Boolean(workspace.qualityEnabled) } });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await qaModuleService.setQualityEnabled(req.params.workspaceId, req.body.qualityEnabled);
  res.json({ success: true, data });
});

export const listModules = asyncHandler(async (req: Request, res: Response) => {
  const { data, pagination } = await qaModuleService.listModules(
    req.params.workspaceId,
    Number(req.query.page) || 1,
    Number(req.query.limit) || 30,
    typeof req.query.projectId === "string" ? req.query.projectId : undefined,
  );
  res.json({ success: true, data, pagination });
});

export const createModule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaModuleService.createModule(req.params.workspaceId, req.user!.id, {
    name: req.body.name,
    space: req.body.space,
    projectId: typeof req.query.projectId === "string" ? req.query.projectId : req.body.projectId,
  });
  res.status(201).json({ success: true, data });
});

export const archiveModule = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await qaModuleService.archiveModule(req.params.workspaceId, req.params.moduleId, String(req.query.projectId || "workspace"), req.user!.id);
  res.json({ success: true, data });
});
