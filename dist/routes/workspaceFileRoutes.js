"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router({ mergeParams: true });
const workspaceFileController = require("../controllers/workspaceFileController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * /api/workspaces/{workspaceId}/files/init-upload:
 *   post:
 *     summary: Generate Cloudinary upload signature
 *     description: Get signature and credentials for direct Cloudinary upload
 *     tags: [Workspace Files]
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
 *         description: Upload signature generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     signature:
 *                       type: string
 *                     timestamp:
 *                       type: number
 *                     cloudName:
 *                       type: string
 *                     apiKey:
 *                       type: string
 *                     folder:
 *                       type: string
 *       403:
 *         description: Not a workspace member
 *       404:
 *         description: Workspace not found
 */
router.post("/init-upload", protect, workspaceFileController.initUpload);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/files/confirm:
 *   post:
 *     summary: Confirm file upload
 *     description: Save file metadata after successful Cloudinary upload
 *     tags: [Workspace Files]
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
 *               - secure_url
 *               - public_id
 *               - resource_type
 *               - format
 *               - bytes
 *               - fileName
 *               - fileType
 *             properties:
 *               secure_url:
 *                 type: string
 *                 description: Cloudinary secure URL
 *               public_id:
 *                 type: string
 *                 description: Cloudinary public ID
 *               resource_type:
 *                 type: string
 *                 description: Resource type (image/video/raw/auto)
 *               format:
 *                 type: string
 *                 description: File format
 *               bytes:
 *                 type: number
 *                 description: File size in bytes
 *               fileName:
 *                 type: string
 *                 description: File name
 *               fileType:
 *                 type: string
 *                 description: MIME type
 *     responses:
 *       201:
 *         description: File saved successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Not a workspace member
 */
router.post("/confirm", protect, workspaceFileController.confirmUpload);
/**
 * @swagger
 * /api/workspaces/{workspaceId}/files:
 *   get:
 *     summary: Get workspace files
 *     description: List all files in workspace with pagination and search
 *     tags: [Workspace Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by file name
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkspaceFile'
 *                 pagination:
 *                   type: object
 *       403:
 *         description: Not a workspace member
 */
router.get("/", protect, workspaceFileController.getFiles);
/**
 * @swagger
 * /api/workspace-files/{id}:
 *   get:
 *     summary: Get single file
 *     description: Get file details by ID
 *     tags: [Workspace Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File retrieved successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Not a workspace member
 */
const fileRouter = express.Router();
fileRouter.get("/:id", protect, workspaceFileController.getFile);
/**
 * @swagger
 * /api/workspace-files/{id}:
 *   delete:
 *     summary: Delete file
 *     description: Delete file (uploader or workspace admin/owner only)
 *     tags: [Workspace Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       403:
 *         description: No permission to delete
 *       404:
 *         description: File not found
 */
fileRouter.delete("/:id", protect, workspaceFileController.deleteFile);
module.exports = { workspaceFileRouter: router, fileRouter };
