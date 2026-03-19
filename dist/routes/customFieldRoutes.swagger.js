"use strict";
/**
 * @swagger
 * /api/custom-fields/workspaces/{workspaceId}:
 *   get:
 *     summary: Get custom field definitions
 *     description: Returns all custom field definitions for a workspace
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
 *         description: List of custom fields
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [text, number, date, dropdown, checkbox]
 *                   options:
 *                     type: array
 *                     items:
 *                       type: string
 *                   required:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create custom field
 *     description: Creates a new custom field definition
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Field name
 *                 example: "Sprint Number"
 *               type:
 *                 type: string
 *                 enum: [text, number, date, dropdown, checkbox]
 *                 description: Field type
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Options for dropdown fields
 *               required:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Custom field created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *
 * /api/custom-fields/{id}:
 *   patch:
 *     summary: Update custom field
 *     description: Updates a custom field definition
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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Custom field not found
 *   delete:
 *     summary: Delete custom field
 *     description: Deletes a custom field definition
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
 *         description: Unauthorized
 *       404:
 *         description: Custom field not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
