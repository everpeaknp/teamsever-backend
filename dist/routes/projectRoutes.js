"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createProject, getProjects, getProject, updateProject, deleteProject } = require("../controllers/projectController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management within workspaces
 */
const router = express.Router({ mergeParams: true });
// Workspace-scoped routes
/**
 * @swagger
 * /api/workspaces/{workspaceId}/projects:
 *   post:
 *     summary: Create project
 *     description: Create a new project in a workspace
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created successfully
 *       401:
 *         description: Authentication required
 *   get:
 *     summary: Get all projects
 *     description: Retrieve all projects in a workspace
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.post("/", protect, requirePermission("VIEW_WORKSPACE"), createProject);
router.get("/", protect, requirePermission("VIEW_WORKSPACE"), getProjects);
// Project-specific routes (standalone)
const projectRouter = express.Router();
/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project
 *     description: Retrieve a specific project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Project not found
 *   patch:
 *     summary: Update project
 *     description: Update project details
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Project updated successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Project not found
 *   delete:
 *     summary: Delete project
 *     description: Delete a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Project not found
 */
projectRouter.get("/:id", protect, getProject);
projectRouter.patch("/:id", protect, updateProject);
projectRouter.delete("/:id", protect, deleteProject);
module.exports = { workspaceProjectRouter: router, projectRouter };
