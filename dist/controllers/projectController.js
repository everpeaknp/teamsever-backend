"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const projectService = require("../services/projectService");
const AppError = require("../utils/AppError");
// @desc    Create new project
// @route   POST /api/workspaces/:workspaceId/projects
// @access  Private
const createProject = asyncHandler(async (req, res, next) => {
    const { name, description } = req.body;
    const { workspaceId } = req.params;
    if (!name) {
        throw new AppError("Please provide project name", 400);
    }
    const project = await projectService.createProject({
        name,
        description,
        workspaceId,
        ownerId: req.user.id
    }, req.user.id);
    res.status(201).json({
        success: true,
        data: project
    });
});
// @desc    Get all projects in workspace
// @route   GET /api/workspaces/:workspaceId/projects
// @access  Private
const getProjects = asyncHandler(async (req, res, next) => {
    const { workspaceId } = req.params;
    const result = await projectService.getProjects(workspaceId, req.query);
    res.status(200).json({
        success: true,
        ...result
    });
});
// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
const getProject = asyncHandler(async (req, res, next) => {
    const project = await projectService.getProjectById(req.params.id);
    res.status(200).json({
        success: true,
        data: project
    });
});
// @desc    Update project
// @route   PATCH /api/projects/:id
// @access  Private
const updateProject = asyncHandler(async (req, res, next) => {
    const { name, description } = req.body;
    const project = await projectService.updateProject(req.params.id, { name, description }, req.user.id);
    res.status(200).json({
        success: true,
        data: project
    });
});
// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = asyncHandler(async (req, res, next) => {
    const result = await projectService.deleteProject(req.params.id, req.user.id);
    res.status(200).json({
        success: true,
        data: result
    });
});
module.exports = {
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject
};
