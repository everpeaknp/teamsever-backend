const express = require("express");
const {
  createTable,
  getSpaceTables,
  getTable,
  updateTable,
  deleteTable,
  addColumn,
  updateColumn,
  deleteColumn,
  addRow,
  deleteRow,
  updateCell,
  updateCellColor,
  updateCellTextColor,
  exportTable
} = require("../controllers/customTableController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkTableLimit, checkRowLimit } = require("../middlewares/subscriptionMiddleware");
const rateLimit = require("express-rate-limit");

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
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *             $ref: "#/components/schemas/TableCreateInput"
 *     responses:
 *       201:
 *         description: Table created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
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
 *         description: Table limit reached or feature not available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get space tables
 *     description: Retrieve all tables in a space
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceTableRouter.post(
  "/",
  protect,
  requirePermission("CREATE_SPACE"),
  createTableLimiter,
  checkTableLimit,
  createTable
);

spaceTableRouter.get(
  "/",
  protect,
  requirePermission("VIEW_SPACE"),
  readTableLimiter,
  getSpaceTables
);

// Standalone table router
const tableRouter = express.Router();

/**
 * @swagger
 * /api/tables/{tableId}:
 *   get:
 *     summary: Get table
 *     description: Retrieve a specific table by ID
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *       404:
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   patch:
 *     summary: Update table
 *     description: Update table name
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
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
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete table
 *     description: Soft delete a table
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.get(
  "/:tableId",
  protect,
  requirePermission("VIEW_SPACE"),
  readTableLimiter,
  getTable
);

tableRouter.patch(
  "/:tableId",
  protect,
  requirePermission("UPDATE_SPACE"),
  updateTable
);

tableRouter.delete(
  "/:tableId",
  protect,
  requirePermission("DELETE_SPACE"),
  deleteTable
);

/**
 * @swagger
 * /api/tables/{tableId}/columns:
 *   post:
 *     summary: Add column to table
 *     description: Add a new column to a custom table
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *             $ref: "#/components/schemas/TableColumnInput"
 *     responses:
 *       201:
 *         description: Column added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
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
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.post(
  "/:tableId/columns",
  protect,
  requirePermission("UPDATE_SPACE"),
  addColumn
);

/**
 * @swagger
 * /api/tables/{tableId}/columns/{columnId}:
 *   patch:
 *     summary: Update column
 *     description: Update a column's title or type
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
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
 *         description: Table or column not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete column
 *     description: Delete a column and its data from all rows
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         description: Table or column not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.patch(
  "/:tableId/columns/:columnId",
  protect,
  requirePermission("UPDATE_SPACE"),
  updateColumn
);

tableRouter.delete(
  "/:tableId/columns/:columnId",
  protect,
  requirePermission("DELETE_SPACE"),
  deleteColumn
);

/**
 * @swagger
 * /api/tables/{tableId}/rows:
 *   post:
 *     summary: Add row to table
 *     description: Add a new row to a custom table
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         description: Row limit reached or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.post(
  "/:tableId/rows",
  protect,
  requirePermission("UPDATE_SPACE"),
  checkRowLimit,
  addRow
);

/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}:
 *   delete:
 *     summary: Delete row from table
 *     description: Delete a row from a custom table
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         description: Table or row not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.delete(
  "/:tableId/rows/:rowId",
  protect,
  requirePermission("DELETE_SPACE"),
  deleteRow
);

/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/cells/{columnId}:
 *   patch:
 *     summary: Update cell value
 *     description: Update a cell value with type validation
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *             $ref: "#/components/schemas/TableCellUpdateInput"
 *     responses:
 *       200:
 *         description: Cell updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Validation error (invalid value for column type)
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
 *         description: Table, row, or column not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.patch(
  "/:tableId/rows/:rowId/cells/:columnId",
  protect,
  requirePermission("UPDATE_SPACE"),
  cellUpdateLimiter,
  updateCell
);

/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/colors/{columnId}:
 *   patch:
 *     summary: Update cell background color
 *     description: Update a cell's background color with hex format validation
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Invalid color format
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
 *         description: Table, row, or column not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.patch(
  "/:tableId/rows/:rowId/colors/:columnId",
  protect,
  requirePermission("UPDATE_SPACE"),
  cellUpdateLimiter,
  updateCellColor
);

/**
 * @swagger
 * /api/tables/{tableId}/rows/{rowId}/text-colors/{columnId}:
 *   patch:
 *     summary: Update cell text color
 *     description: Update a cell's text color with hex format validation
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       400:
 *         description: Invalid color format
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
 *         description: Table, row, or column not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.patch(
  "/:tableId/rows/:rowId/text-colors/:columnId",
  protect,
  requirePermission("UPDATE_SPACE"),
  cellUpdateLimiter,
  updateCellTextColor
);

/**
 * @swagger
 * /api/tables/{tableId}/export:
 *   get:
 *     summary: Export table to Excel
 *     description: Export a custom table to Excel format with color preservation
 *     tags: ["8.1 Tables — Core CRUD"]
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
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       429:
 *         description: Rate limit exceeded (3 exports per minute)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       500:
 *         description: Export failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
tableRouter.get(
  "/:tableId/export",
  protect,
  requirePermission("VIEW_SPACE"),
  exportLimiter,
  exportTable
);

module.exports = { spaceTableRouter, tableRouter };

export {};
