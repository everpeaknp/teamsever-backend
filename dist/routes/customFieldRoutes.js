"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createCustomField, updateCustomField, deleteCustomField, getFieldsByWorkspace, getFieldsByProject } = require("../controllers/customFieldController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { createCustomFieldSchema, updateCustomFieldSchema } = require("../validators/customFieldValidators");
/**
 * @swagger
 * tags:
 *   name: Custom Fields
 *   description: Custom field definitions for workspaces
 */
const customFieldRouter = express.Router();
/**
 * @swagger
 * /api/custom-fields:
 *   post:
 *     summary: Create custom field
 *     description: Create a new custom field definition for a workspace
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - name
 *               - type
 *             properties:
 *               workspaceId:
 *                 type: string
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, number, date, dropdown, checkbox]
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               required:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Custom field created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
customFieldRouter.post("/", protect, validate(createCustomFieldSchema), createCustomField);
/**
 * @swagger
 * /api/custom-fields/{id}:
 *   put:
 *     summary: Update custom field
 *     description: Update an existing custom field definition
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom field ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               required:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Custom field updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Custom field not found
 *   delete:
 *     summary: Delete custom field
 *     description: Remove a custom field definition
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom field ID
 *     responses:
 *       200:
 *         description: Custom field deleted successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Custom field not found
 */
customFieldRouter.put("/:id", protect, validate(updateCustomFieldSchema), updateCustomField);
customFieldRouter.delete("/:id", protect, deleteCustomField);
/**
 * @swagger
 * /api/custom-fields/workspace/{workspaceId}:
 *   get:
 *     summary: Get workspace custom fields
 *     description: Retrieve all custom fields for a workspace
 *     tags: [Custom Fields]
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
 *         description: Custom fields retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
customFieldRouter.get("/workspace/:workspaceId", protect, getFieldsByWorkspace);
/**
 * @swagger
 * /api/custom-fields/project/{projectId}:
 *   get:
 *     summary: Get project custom fields
 *     description: Retrieve all custom fields for a project
 *     tags: [Custom Fields]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Custom fields retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Project not found
 */
customFieldRouter.get("/project/:projectId", protect, getFieldsByProject);
module.exports = customFieldRouter;
