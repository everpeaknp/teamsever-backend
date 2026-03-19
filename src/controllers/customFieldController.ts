import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const customFieldService = require("../services/customFieldService");

// @desc    Create custom field
// @route   POST /api/custom-fields
// @access  Private (Admin/Project Owner)
const createCustomField = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, type, options, workspace, project } = req.body;

  const customField = await customFieldService.createCustomField({
    name,
    type,
    options,
    workspaceId: workspace,
    projectId: project,
    userId: req.user!.id
  });

  res.status(201).json({
    success: true,
    data: customField
  });
});

// @desc    Update custom field
// @route   PUT /api/custom-fields/:id
// @access  Private (Admin/Project Owner)
const updateCustomField = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { name, options } = req.body;

  const customField = await customFieldService.updateCustomField(id, req.user!.id, {
    name,
    options
  });

  res.status(200).json({
    success: true,
    data: customField
  });
});

// @desc    Delete custom field
// @route   DELETE /api/custom-fields/:id
// @access  Private (Admin/Project Owner)
const deleteCustomField = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const result = await customFieldService.deleteCustomField(id, req.user!.id);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get custom fields by workspace
// @route   GET /api/custom-fields/workspace/:workspaceId
// @access  Private
const getFieldsByWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;

  const customFields = await customFieldService.getFieldsByWorkspace(workspaceId, req.user!.id);

  res.status(200).json({
    success: true,
    count: customFields.length,
    data: customFields
  });
});

// @desc    Get custom fields by project
// @route   GET /api/custom-fields/project/:projectId
// @access  Private
const getFieldsByProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { projectId } = req.params;

  const customFields = await customFieldService.getFieldsByProject(projectId, req.user!.id);

  res.status(200).json({
    success: true,
    count: customFields.length,
    data: customFields
  });
});

module.exports = {
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getFieldsByWorkspace,
  getFieldsByProject
};

export {};
