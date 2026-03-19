"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createList, getSpaceLists, getList, updateList, deleteList } = require("../controllers/listController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkListLimit } = require("../middlewares/subscriptionMiddleware");
const validate = require("../utils/validation");
const { createListSchema, updateListSchema } = require("../validators/listValidators");
/**
 * @swagger
 * tags:
 *   name: Lists
 *   description: List management within spaces
 */
// Space-scoped router
const spaceListRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/spaces/{spaceId}/lists:
 *   post:
 *     summary: Create list
 *     description: Create a new list in a space
 *     tags: [Lists]
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: List limit reached or insufficient permissions
 *   get:
 *     summary: Get lists
 *     description: Retrieve all lists in a space
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Lists retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Space not found
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
 *     description: Retrieve a specific list by ID
 *     tags: [Lists]
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
 *         description: List retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: List not found
 *   patch:
 *     summary: Update list
 *     description: Update list details
 *     tags: [Lists]
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: List not found
 *   delete:
 *     summary: Delete list
 *     description: Delete a list and its contents
 *     tags: [Lists]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: List not found
 */
listRouter.get("/:id", protect, requirePermission("VIEW_LIST"), getList);
listRouter.patch("/:id", protect, requirePermission("UPDATE_LIST"), require("../middlewares/ownerOnly"), validate(updateListSchema), updateList);
listRouter.delete("/:id", protect, requirePermission("DELETE_LIST"), deleteList);
module.exports = { spaceListRouter, listRouter };
