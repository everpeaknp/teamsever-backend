"use strict";
/**
 * @swagger
 * /api/docs/workspace/{workspaceId}/hierarchy:
 *   get:
 *     summary: Get document hierarchy
 *     description: Returns the hierarchical structure of all documents in a workspace
 *     tags: [Documents]
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
 *         description: Document hierarchy tree
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   icon:
 *                     type: string
 *                   children:
 *                     type: array
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/docs:
 *   post:
 *     summary: Create a new document
 *     description: Creates a new document in a workspace
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - workspaceId
 *             properties:
 *               title:
 *                 type: string
 *                 description: Document title
 *                 example: "Project Requirements"
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               parentId:
 *                 type: string
 *                 description: Parent document ID (for nested documents)
 *               content:
 *                 type: string
 *                 description: Document content (rich text/markdown)
 *               icon:
 *                 type: string
 *                 description: Document icon emoji
 *                 example: "📄"
 *     responses:
 *       201:
 *         description: Document created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 workspaceId:
 *                   type: string
 *                 parentId:
 *                   type: string
 *                 icon:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *
 * /api/docs/{id}:
 *   get:
 *     summary: Get document by ID
 *     description: Returns detailed document information including content
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 workspaceId:
 *                   type: string
 *                 parentId:
 *                   type: string
 *                 icon:
 *                   type: string
 *                 createdBy:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *   patch:
 *     summary: Update document
 *     description: Updates document properties and content
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               icon:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 *   delete:
 *     summary: Delete document
 *     description: Deletes a document and all its children
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
