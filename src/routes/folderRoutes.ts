const express = require("express");
const {
  createFolder,
  getFolders,
  getFolder,
  updateFolder,
  deleteFolder
} = require("../controllers/folderController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkFolderLimit } = require("../middlewares/subscriptionMiddleware");

/**
 * @swagger
 * tags:
 *   name: "3. Project Hierarchy"
 *   description: "Folder management within spaces"
 */

// Space-scoped router
const spaceFolderRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/spaces/{spaceId}/folders:
 *   post:
 *     summary: Create folder
 *     description: Create a new folder in a space
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/FolderResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Folder limit reached or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get folders in a space
 *     description: Retrieve all folders in a space, ordered by creation date.
 *     tags: ["3. Project Hierarchy"]
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
 *             schema:
 *               $ref: "#/components/schemas/FolderListResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
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
 *     tags: ["3. Project Hierarchy"]
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
 *             schema:
 *               $ref: "#/components/schemas/FolderResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   put:
 *     summary: Update folder
 *     description: Update folder details
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/FolderResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete folder
 *     description: Delete a folder and its contents
 *     tags: ["3. Project Hierarchy"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
folderRouter.get("/:id", protect, requirePermission("VIEW_FOLDER"), getFolder);
folderRouter.put("/:id", protect, requirePermission("UPDATE_FOLDER"), require("../middlewares/ownerOnly"), updateFolder);
folderRouter.delete("/:id", protect, requirePermission("DELETE_FOLDER"), deleteFolder);

module.exports = { spaceFolderRouter, folderRouter };

export {};
