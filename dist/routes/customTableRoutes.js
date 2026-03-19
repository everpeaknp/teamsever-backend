"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createTable, getSpaceTables, getTable, updateTable, deleteTable, addColumn, updateColumn, deleteColumn, addRow, deleteRow, updateCell, updateCellColor, updateCellTextColor, exportTable } = require("../controllers/customTableController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkTableLimit, checkRowLimit } = require("../middlewares/subscriptionMiddleware");
const rateLimit = require("express-rate-limit");
/**
 * @swagger
 * tags:
 *   name: Custom Tables
 *   description: Custom table management within spaces
 */
// Rate limiters
const createTableLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
        success: false,
        message: "Too many table creation requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});
const readTableLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        message: "Too many table read requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});
const cellUpdateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 cell updates per minute
    message: {
        success: false,
        message: "Too many cell update requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});
const exportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 exports per minute
    message: {
        success: false,
        message: "Too many export requests. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});
// Space-scoped router for tables
const spaceTableRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/spaces/{spaceId}/tables:
 *   post:
 *     summary: Create custom table
 *     description: Create a new custom table in a space
 *     tags: [Custom Tables]
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
 *                 description: Table name
 *               columns:
 *                 type: array
 *                 description: Initial columns (optional)
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [text, link, number]
 *     responses:
 *       201:
 *         description: Table created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Table limit reached or feature not available
 *   get:
 *     summary: Get space tables
 *     description: Retrieve all tables in a space
 *     tags: [Custom Tables]
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
 *         description: Tables retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Space not found
 */
spaceTableRouter.post("/", protect, requirePermission("CREATE_SPACE"), createTableLimiter, checkTableLimit, createTable);
spaceTableRouter.get("/", protect, requirePermission("VIEW_SPACE"), readTableLimiter, getSpaceTables);
// Standalone table router
const tableRouter = express.Router();
/**
 * @swagger
 * /api/tables/{tableId}:
 *   get:
 *     summary: Get table
 *     description: Retrieve a specific table by ID
 *     tags: [Custom Tables]
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
 *         description: Table retrieved successfully
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Table not found
 *   patch:
 *     summary: Update table
 *     description: Update table name
 *     tags: [Custom Tables]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: New table name
 *     responses:
 *       200:
 *         description: Table updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table not found
 *   delete:
 *     summary: Delete table
 *     description: Soft delete a table
 *     tags: [Custom Tables]
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
 *         description: Table deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table not found
 */
tableRouter.get("/:tableId", protect, requirePermission("VIEW_SPACE"), readTableLimiter, getTable);
tableRouter.patch("/:tableId", protect, requirePermission("UPDATE_SPACE"), updateTable);
tableRouter.delete("/:tableId", protect, requirePermission("DELETE_SPACE"), deleteTable);
/**
 * @swagger
 * /api/tables/{tableId}/columns:
 *   post:
 *     summary: Add column to table
 *     description: Add a new column to a custom table
 *     tags: [Custom Tables]
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
 *               - title
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 description: Column title
 *               type:
 *                 type: string
 *                 enum: [text, link, number]
 *                 description: Column type
 *     responses:
 *       201:
 *         description: Column added successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table not found
 */
tableRouter.post("/:tableId/columns", protect, requirePermission("UPDATE_SPACE"), addColumn);
/**
 * @swagger
 * /api/tables/{tableId}/columns/{columnId}:
 *   patch:
 *     summary: Update column
 *     description: Update a column's title or type
 *     tags: [Custom Tables]
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
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Column ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 description: New column title
 *               type:
 *                 type: string
 *                 enum: [text, link, number]
 *                 description: New column type
 *     responses:
 *       200:
 *         description: Column updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table or column not found
 *   delete:
 *     summary: Delete column
 *     description: Delete a column and its data from all rows
 *     tags: [Custom Tables]
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
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Column ID
 *     responses:
 *       200:
 *         description: Column deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table or column not found
 */
tableRouter.patch("/:tableId/columns/:columnId", protect, requirePermission("UPDATE_SPACE"), updateColumn);
tableRouter.delete("/:tableId/columns/:columnId", protect, requirePermission("DELETE_SPACE"), deleteColumn);
/**
 * @swagger
 * /api/tables/{tableId}/rows:
 *   post:
 *     summary: Add row to table
 *     description: Add a new row to a custom table
 *     tags: [Custom Tables]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 description: Initial cell data (optional)
 *                 additionalProperties: true
 *     responses:
 *       201:
 *         description: Row added successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Row limit reached or insufficient permissions
 *       404:
 *         description: Table not found
 */
tableRouter.post("/:tableId/rows", protect, requirePermission("UPDATE_SPACE"), checkRowLimit, addRow);
/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}:
 *   delete:
 *     summary: Delete row from table
 *     description: Delete a row from a custom table
 *     tags: [Custom Tables]
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
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Row ID
 *     responses:
 *       200:
 *         description: Row deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table or row not found
 */
tableRouter.delete("/:tableId/rows/:rowId", protect, requirePermission("DELETE_SPACE"), deleteRow);
/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/cells/{columnId}:
 *   patch:
 *     summary: Update cell value
 *     description: Update a cell value with type validation
 *     tags: [Custom Tables]
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
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Row ID
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Column ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                 description: Cell value (validated based on column type)
 *     responses:
 *       200:
 *         description: Cell updated successfully
 *       400:
 *         description: Validation error (invalid value for column type)
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table, row, or column not found
 */
tableRouter.patch("/:tableId/rows/:rowId/cells/:columnId", protect, requirePermission("UPDATE_SPACE"), cellUpdateLimiter, updateCell);
/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/colors/{columnId}:
 *   patch:
 *     summary: Update cell background color
 *     description: Update a cell's background color with hex format validation
 *     tags: [Custom Tables]
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
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Row ID
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Column ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - color
 *             properties:
 *               color:
 *                 type: string
 *                 nullable: true
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 description: Hex color code (#RRGGBB) or null to remove color
 *                 example: '#FF5733'
 *     responses:
 *       200:
 *         description: Cell color updated successfully
 *       400:
 *         description: Invalid color format
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table, row, or column not found
 */
tableRouter.patch("/:tableId/rows/:rowId/colors/:columnId", protect, requirePermission("UPDATE_SPACE"), cellUpdateLimiter, updateCellColor);
/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/text-colors/{columnId}:
 *   patch:
 *     summary: Update cell text color
 *     description: Update a cell's text color with hex format validation
 *     tags: [Custom Tables]
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
 *         name: rowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Row ID
 *       - in: path
 *         name: columnId
 *         required: true
 *         schema:
 *           type: string
 *         description: Column ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - color
 *             properties:
 *               color:
 *                 type: string
 *                 nullable: true
 *                 pattern: '^#[0-9A-Fa-f]{6}$'
 *                 description: Hex color code (#RRGGBB) or null to remove color
 *                 example: '#000000'
 *     responses:
 *       200:
 *         description: Cell text color updated successfully
 *       400:
 *         description: Invalid color format
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table, row, or column not found
 */
tableRouter.patch("/:tableId/rows/:rowId/text-colors/:columnId", protect, requirePermission("UPDATE_SPACE"), cellUpdateLimiter, updateCellTextColor);
/**
 * @swagger
 * /api/tables/{tableId}/export:
 *   get:
 *     summary: Export table to Excel
 *     description: Export a custom table to Excel format with color preservation
 *     tags: [Custom Tables]
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
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Table not found
 *       429:
 *         description: Rate limit exceeded (3 exports per minute)
 *       500:
 *         description: Export failed
 */
tableRouter.get("/:tableId/export", protect, requirePermission("VIEW_SPACE"), exportLimiter, exportTable);
module.exports = { spaceTableRouter, tableRouter };
