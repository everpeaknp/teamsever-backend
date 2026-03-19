"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { getTableMembers, addTableMember, updateTableMember, removeTableMember, } = require("../controllers/tableMemberController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
/**
 * @swagger
 * tags:
 *   name: Table Members
 *   description: Custom table member permission management
 */
const router = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/tables/{tableId}/table-members:
 *   get:
 *     summary: Get table members
 *     description: Retrieve all table members with their permission overrides
 *     tags: [Table Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *         description: Table ID
 *     responses:
 *       200:
 *         description: Table members retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Table not found
 *   post:
 *     summary: Add table member override
 *     description: Add or update table-level permission override for a member
 *     tags: [Table Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *         description: Table ID
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
 *         description: Table member added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.get("/", protect, getTableMembers);
router.post("/", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), addTableMember);
/**
 * @swagger
 * /api/tables/{tableId}/table-members/{userId}:
 *   patch:
 *     summary: Update table member permissions
 *     description: Update table-level permission override for a member
 *     tags: [Table Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *         description: Table ID
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
 *         description: Table member updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table member not found
 *   delete:
 *     summary: Remove table member override
 *     description: Remove table-level permission override for a member
 *     tags: [Table Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *         description: Table ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Table member override removed successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table member not found
 */
router.patch("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), updateTableMember);
router.delete("/:userId", protect, requirePermission("MANAGE_SPACE_PERMISSIONS"), removeTableMember);
module.exports = router;
