"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const documentController = require("../controllers/documentController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management and collaboration
 */
const router = express.Router();
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create document
 *     description: Create a new document
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
 *               workspaceId:
 *                 type: string
 *               content:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.post("/", documentController.createDocument);
/**
 * @swagger
 * /api/documents/me:
 *   get:
 *     summary: Get my documents
 *     description: Retrieve all documents created by the current user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/me", documentController.getMyDocuments);
/**
 * @swagger
 * /api/documents/workspace/{workspaceId}:
 *   get:
 *     summary: Get workspace documents
 *     description: Retrieve all documents in a workspace
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
 *         description: Documents retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/workspace/:workspaceId", documentController.getWorkspaceDocuments);
/**
 * @swagger
 * /api/documents/workspace/{workspaceId}/hierarchy:
 *   get:
 *     summary: Get document hierarchy
 *     description: Retrieve document hierarchy for a workspace
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
 *         description: Document hierarchy retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
 */
router.get("/workspace/:workspaceId/hierarchy", documentController.getDocumentHierarchy);
/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get document
 *     description: Retrieve a specific document by ID
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
 *         description: Document retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Document not found
 *   patch:
 *     summary: Update document
 *     description: Update document content or metadata
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
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Document not found
 *   delete:
 *     summary: Delete document
 *     description: Delete a document
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
 *         description: Authentication required
 *       404:
 *         description: Document not found
 */
router.get("/:id", documentController.getDocument);
router.patch("/:id", documentController.updateDocument);
router.delete("/:id", documentController.deleteDocument);
module.exports = router;
