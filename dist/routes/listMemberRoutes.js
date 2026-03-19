"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { getListMembers, addListMember, updateListMember, removeListMember, } = require("../controllers/listMemberController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
/**
 * @swagger
 * tags:
 *   name: List Members
 *   description: List-level member permission management
 */
const router = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/lists/{listId}/list-members:
 *   get:
 *     summary: Get list members
 *     description: Retrieve all list members with their permission overrides
 *     tags: [List Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     responses:
 *       200:
 *         description: List members retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: List not found
 *   post:
 *     summary: Add list member override
 *     description: Add or update list-level permission override for a member
 *     tags: [List Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
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
 *             required:
 *               - userId
 *               - permissions
 *             properties:
 *               userId:
 *                 type: string
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: List member added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get("/", protect, requirePermission("VIEW_LIST"), getListMembers);
router.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), addListMember);
/**
 * @swagger
 * /api/lists/{listId}/list-members/{userId}:
 *   patch:
 *     summary: Update list member permissions
 *     description: Update list-level permission override for a member
 *     tags: [List Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: object
 *     responses:
 *       200:
 *         description: List member updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: List member not found
 *   delete:
 *     summary: Remove list member override
 *     description: Remove list-level permission override for a member
 *     tags: [List Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List member override removed successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: List member not found
 */
router.patch("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), updateListMember);
router.delete("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), removeListMember);
module.exports = router;
