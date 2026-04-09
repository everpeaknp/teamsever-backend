const express = require("express");
const {
  createList,
  getSpaceLists,
  getList,
  updateList,
  deleteList
} = require("../controllers/listController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkListLimit } = require("../middlewares/subscriptionMiddleware");
const validate = require("../utils/validation");
const { createListSchema, updateListSchema } = require("../validators/listValidators");

/**
 * @swagger
 * tags:
 *   name: "3. Project Hierarchy"
 *   description: "List management within spaces"
 */

// Space-scoped router
const spaceListRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/spaces/{spaceId}/lists:
 *   post:
 *     summary: Create list
 *     description: Create a new list in a space
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
 *         description: List created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ListResponse"
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
 *         description: List limit reached or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get lists in a space
 *     description: Retrieve all lists in a space (not inside a folder).
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
 *         description: Lists retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ListListResponse"
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
spaceListRouter.post("/", protect, requirePermission("CREATE_LIST"), checkListLimit, validate(createListSchema), createList);
spaceListRouter.get("/", protect, requirePermission("VIEW_LIST"), getSpaceLists);

// Standalone list router
const listRouter = express.Router();

/**
 * @swagger
 * /api/lists/{id}:
 *   get:
 *     summary: Get list
 *     description: Get a single list with its tasks count and metadata.
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
 *         description: List retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ListResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: List not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   patch:
 *     summary: Update list
 *     description: Update list details
 *     tags: ["3. Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
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
 *         description: List updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ListResponse"
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
 *         description: List not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete list
 *     description: Delete a list and its contents
 *     tags: ["3. Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     responses:
 *       200:
 *         description: List deleted successfully
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
 *         description: List not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
listRouter.get("/:id", protect, requirePermission("VIEW_LIST"), getList);
listRouter.patch("/:id", protect, requirePermission("UPDATE_LIST"), require("../middlewares/ownerOnly"), validate(updateListSchema), updateList);
listRouter.delete("/:id", protect, requirePermission("DELETE_LIST"), deleteList);

module.exports = { spaceListRouter, listRouter };

export {};
