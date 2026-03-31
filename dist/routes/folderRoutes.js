"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createFolder, getFolders, getFolder, updateFolder, deleteFolder } = require("../controllers/folderController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkFolderLimit } = require("../middlewares/subscriptionMiddleware");
/**
 * @swagger
 * tags:
 *   name: Folders
 *   description: Folder management within spaces
 */
// Space-scoped router
const spaceFolderRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/spaces/{spaceId}/folders:
 *   post:
 *     summary: Create folder
 *     description: Create a new folder in a space
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
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
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Folder created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Folder limit reached or insufficient permissions
 *   get:
 *     summary: Get folders in a space
 *     description: Retrieve all folders in a space, ordered by creation date.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Folders retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f716753a1"
 *                   name: "Sprint 5"
 *                   description: "Current sprint"
 *                   color: "#6366f1"
 *                   space: "69bbf827a96fe78f716753b2"
 *                   listCount: 3
 *                   createdAt: "2026-03-01T08:00:00Z"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Space not found
 */
spaceFolderRouter.post("/", protect, requirePermission("CREATE_FOLDER"), checkFolderLimit, createFolder);
spaceFolderRouter.get("/", protect, requirePermission("VIEW_FOLDER"), getFolders);
// Standalone folder router
const folderRouter = express.Router();
/**
 * @swagger
 * /api/folders/{id}:
 *   get:
 *     summary: Get folder
 *     description: Returns a single folder with its lists.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Folder retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f716753a1"
 *                 name: "Sprint 5"
 *                 description: "Current sprint folder"
 *                 color: "#6366f1"
 *                 space: "69bbf827a96fe78f716753b2"
 *                 lists:
 *                   - _id: "69bbf827a96fe78f716753c3"
 *                     name: "Backend Tasks"
 *                     taskCount: 12
 *                   - _id: "69bbf827a96fe78f716753c4"
 *                     name: "Frontend Tasks"
 *                     taskCount: 8
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Folder not found
 *   put:
 *     summary: Update folder
 *     description: Update folder details
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
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
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Folder updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 *   delete:
 *     summary: Delete folder
 *     description: Delete a folder and its contents
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: Folder deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Folder not found
 */
folderRouter.get("/:id", protect, requirePermission("VIEW_FOLDER"), getFolder);
folderRouter.put("/:id", protect, requirePermission("UPDATE_FOLDER"), require("../middlewares/ownerOnly"), updateFolder);
folderRouter.delete("/:id", protect, requirePermission("DELETE_FOLDER"), deleteFolder);
module.exports = { spaceFolderRouter, folderRouter };
