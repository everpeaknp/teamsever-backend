import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const customTableService = require("../services/customTableService").default;
const excelExportService = require("../services/excelExportService").default;
const permissionService = require("../permissions/permission.service");

// Helper function to check table permissions
async function checkTablePermission(
  tableId: string | string[],
  userId: string,
  requiredLevel: 'VIEW' | 'EDIT' | 'FULL'
): Promise<{ hasAccess: boolean; workspaceId: string | null; permissionLevel: string | null; table: any }> {
  const CustomTable = require("../models/CustomTable");
  const Space = require("../models/Space");
  const Workspace = require("../models/Workspace");
  
  // Handle array case (shouldn't happen but TypeScript requires it)
  const tableIdStr = Array.isArray(tableId) ? tableId[0] : tableId;
  
  const table = await CustomTable.findOne({ _id: tableIdStr, isDeleted: false });
  if (!table) {
    return { hasAccess: false, workspaceId: null, permissionLevel: null, table: null };
  }
  
  const space = await Space.findOne({ _id: table.spaceId, isDeleted: false });
  if (!space) {
    return { hasAccess: false, workspaceId: null, permissionLevel: null, table: null };
  }
  
  const workspace = await Workspace.findOne({ _id: space.workspace, isDeleted: false });
  if (!workspace) {
    return { hasAccess: false, workspaceId: null, permissionLevel: null, table: null };
  }
  
  const workspaceId = workspace._id.toString();
  
  // Check if user is admin or owner - they have full access
  const isAdminOrOwner = await permissionService.isAdminOrOwner(userId, workspaceId);
  if (isAdminOrOwner) {
    return { hasAccess: true, workspaceId, permissionLevel: 'FULL', table };
  }
  
  // Check table-specific permission
  const tablePermission = await permissionService.getTablePermissionLevel(userId, tableIdStr);
  
  // If no table permission, user cannot access
  if (!tablePermission) {
    return { hasAccess: false, workspaceId, permissionLevel: null, table: null };
  }
  
  // Check if permission level is sufficient
  const permissionHierarchy: Record<string, number> = {
    'VIEW': 1,
    'EDIT': 2,
    'FULL': 3
  };
  
  const userLevel = permissionHierarchy[tablePermission] || 0;
  const requiredLevelNum = permissionHierarchy[requiredLevel] || 0;
  
  return {
    hasAccess: userLevel >= requiredLevelNum,
    workspaceId,
    permissionLevel: tablePermission,
    table
  };
}

// @desc    Create new custom table
// @route   POST /api/spaces/:spaceId/tables
// @access  Private
const createTable = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, columns, initialRows } = req.body;
  const { spaceId } = req.params;

  const table = await customTableService.createTable(
    spaceId,
    name,
    req.user!.id,
    columns,
    initialRows
  );

  res.status(201).json({
    success: true,
    data: table
  });
});

// @desc    Get all tables in a space (filtered by user permissions)
// @route   GET /api/spaces/:spaceId/tables
// @access  Private
const getSpaceTables = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { spaceId } = req.params;
  
  // Verify user has access to the space
  const Space = require("../models/Space");
  const Workspace = require("../models/Workspace");
  
  const space = await Space.findOne({ _id: spaceId, isDeleted: false });
  if (!space) {
    return res.status(404).json({
      success: false,
      message: "Space not found"
    });
  }
  
  // Check workspace access
  const workspace = await Workspace.findOne({ _id: space.workspace, isDeleted: false });
  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found"
    });
  }
  
  const isWorkspaceMember = workspace.members.some(
    (member: any) => member.user.toString() === req.user!.id
  );
  
  if (!isWorkspaceMember) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this space"
    });
  }
  
  // Check if user is admin or owner
  const isAdminOrOwner = await permissionService.isAdminOrOwner(req.user!.id, workspace._id.toString());
  
  const CustomTable = require("../models/CustomTable");
  const allTables = await CustomTable.find({ 
    spaceId, 
    isDeleted: false 
  }).sort({ createdAt: -1 });

  // Filter tables based on permissions
  let accessibleTables = [];
  
  if (isAdminOrOwner) {
    // Admins and owners can see all tables
    accessibleTables = allTables.map((table: any) => ({
      ...table.toObject(),
      userPermission: 'FULL'
    }));
  } else {
    // Regular members can only see tables they're assigned to
    const { TableMember } = require("../models/TableMember");
    const userTablePermissions = await TableMember.find({
      user: req.user!.id,
      space: spaceId
    }).select('table permissionLevel');
    
    const permissionMap = new Map(
      userTablePermissions.map((tm: any) => [tm.table.toString(), tm.permissionLevel])
    );
    
    accessibleTables = allTables
      .filter((table: any) => permissionMap.has(table._id.toString()))
      .map((table: any) => ({
        ...table.toObject(),
        userPermission: permissionMap.get(table._id.toString())
      }));
  }

  res.status(200).json({
    success: true,
    count: accessibleTables.length,
    data: accessibleTables
  });
});

// @desc    Get single table
// @route   GET /api/tables/:tableId
// @access  Private
const getTable = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;
  
  console.log('[getTable] Request params:', req.params);
  console.log('[getTable] TableId:', tableId);
  
  const { hasAccess, permissionLevel } = await checkTablePermission(tableId, req.user!.id, 'VIEW');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this table"
    });
  }
  
  const CustomTable = require("../models/CustomTable");
  const table = await CustomTable.findOne({ 
    _id: tableId, 
    isDeleted: false 
  });

  if (!table) {
    return res.status(404).json({
      success: false,
      message: "Table not found"
    });
  }

  res.status(200).json({
    success: true,
    data: {
      ...table.toObject(),
      userPermission: permissionLevel
    }
  });
});

// @desc    Update table name
// @route   PATCH /api/tables/:tableId
// @access  Private
const updateTable = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Table name is required"
    });
  }

  const CustomTable = require("../models/CustomTable");
  const Space = require("../models/Space");
  const Workspace = require("../models/Workspace");
  
  const table = await CustomTable.findOne({ _id: tableId, isDeleted: false });
  if (!table) {
    return res.status(404).json({
      success: false,
      message: "Table not found"
    });
  }
  
  // Verify user has access to the space
  const space = await Space.findOne({ _id: table.spaceId, isDeleted: false });
  if (!space) {
    return res.status(404).json({
      success: false,
      message: "Space not found"
    });
  }
  
  // Check workspace access
  const workspace = await Workspace.findOne({ _id: space.workspace, isDeleted: false });
  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found"
    });
  }
  
  const isWorkspaceMember = workspace.members.some(
    (member: any) => member.user.toString() === req.user!.id
  );
  
  if (!isWorkspaceMember) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this table"
    });
  }
  
  // Update the table
  table.name = name;
  await table.save();

  res.status(200).json({
    success: true,
    data: table
  });
});

// @desc    Soft delete table
// @route   DELETE /api/tables/:tableId
// @access  Private (Owner only)
const deleteTable = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;

  const CustomTable = require("../models/CustomTable");
  const Space = require("../models/Space");
  const Workspace = require("../models/Workspace");
  
  // Get table and verify it exists
  const table = await CustomTable.findOne({ _id: tableId, isDeleted: false });
  if (!table) {
    return res.status(404).json({
      success: false,
      message: "Table not found"
    });
  }
  
  // Get space
  const space = await Space.findOne({ _id: table.spaceId, isDeleted: false });
  if (!space) {
    return res.status(404).json({
      success: false,
      message: "Space not found"
    });
  }
  
  // Get workspace
  const workspace = await Workspace.findOne({ _id: space.workspace, isDeleted: false });
  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found"
    });
  }
  
  // Check if user is the workspace owner
  const workspaceOwnerId = typeof workspace.owner === 'string' 
    ? workspace.owner 
    : workspace.owner?._id?.toString();
  
  if (workspaceOwnerId !== req.user!.id) {
    return res.status(403).json({
      success: false,
      message: "Only workspace owners can delete tables"
    });
  }

  await customTableService.deleteTable(tableId, req.user!.id);

  res.status(200).json({
    success: true,
    message: "Table deleted successfully"
  });
});

// @desc    Add column to table
// @route   POST /api/tables/:tableId/columns
// @access  Private (Requires FULL permission)
const addColumn = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;
  const { title, type } = req.body;

  // Check if user has FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'FULL');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to add columns to this table"
    });
  }

  // Check entitlement (column limit)
  const EntitlementService = require("../services/entitlementService").default;
  const entitlement = await EntitlementService.canAddColumn(req.user!.id, tableId);
  
  if (!entitlement.allowed) {
    return res.status(403).json({
      success: false,
      message: entitlement.reason || 'Cannot add column',
      code: 'COLUMN_LIMIT_REACHED'
    });
  }

  // Validate required fields
  if (!title) {
    return res.status(400).json({
      success: false,
      message: "Column title is required"
    });
  }

  if (!type) {
    return res.status(400).json({
      success: false,
      message: "Column type is required"
    });
  }

  // Validate column type enum
  const validTypes = ['text', 'link', 'number'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid column type. Must be one of: ${validTypes.join(', ')}`
    });
  }

  // Validate title length
  if (title.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Column title cannot exceed 100 characters"
    });
  }

  const updatedTable = await customTableService.addColumn(tableId, title, type);

  res.status(201).json({
    success: true,
    data: updatedTable
  });
});

// @desc    Update column
// @route   PATCH /api/tables/:tableId/columns/:columnId
// @access  Private
const updateColumn = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, columnId } = req.params;
  const { title, type } = req.body;

  // Validate at least one field is provided
  if (!title && !type) {
    return res.status(400).json({
      success: false,
      message: "At least one field (title or type) must be provided"
    });
  }

  // Validate column type enum if provided
  if (type) {
    const validTypes = ['text', 'link', 'number'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid column type. Must be one of: ${validTypes.join(', ')}`
      });
    }
  }

  // Validate title length if provided
  if (title && title.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Column title cannot exceed 100 characters"
    });
  }

  const CustomTable = require("../models/CustomTable");
  const Space = require("../models/Space");
  const Workspace = require("../models/Workspace");
  
  // Verify table exists and user has access
  const table = await CustomTable.findOne({ _id: tableId, isDeleted: false });
  if (!table) {
    return res.status(404).json({
      success: false,
      message: "Table not found"
    });
  }
  
  // Verify user has access to the space
  const space = await Space.findOne({ _id: table.spaceId, isDeleted: false });
  if (!space) {
    return res.status(404).json({
      success: false,
      message: "Space not found"
    });
  }
  
  // Check workspace access
  const workspace = await Workspace.findOne({ _id: space.workspace, isDeleted: false });
  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: "Workspace not found"
    });
  }
  
  const isWorkspaceMember = workspace.members.some(
    (member: any) => member.user.toString() === req.user!.id
  );
  
  if (!isWorkspaceMember) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this table"
    });
  }

  const updates: { title?: string; type?: 'text' | 'link' | 'number' } = {};
  if (title) updates.title = title;
  if (type) updates.type = type;

  const updatedTable = await customTableService.updateColumn(tableId, columnId, updates);

  res.status(200).json({
    success: true,
    data: updatedTable
  });
});

// @desc    Delete column
// @route   DELETE /api/tables/:tableId/columns/:columnId
// @access  Private (Requires FULL permission)
const deleteColumn = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, columnId } = req.params;

  // Check if user has FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'FULL');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete columns from this table"
    });
  }

  const updatedTable = await customTableService.deleteColumn(tableId, columnId);

  res.status(200).json({
    success: true,
    data: updatedTable
  });
});

// @desc    Add row to table
// @desc    Add row to table
// @route   POST /api/tables/:tableId/rows
// @access  Private (Requires FULL permission)
const addRow = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;
  const { data } = req.body || {}; // Make data optional

  // Check if user has FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'FULL');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to add rows to this table"
    });
  }

  const result = await customTableService.addRow(tableId, req.user!.id, data);

  res.status(201).json({
    success: true,
    data: result.table,
    rowId: result.rowId
  });
});

// @desc    Delete row from table
// @route   DELETE /api/tables/:tableId/rows/:rowId
// @access  Private (Requires FULL permission)
const deleteRow = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, rowId } = req.params;

  // Check if user has FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'FULL');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete rows from this table"
    });
  }

  const updatedTable = await customTableService.deleteRow(tableId, rowId, req.user!.id);

  res.status(200).json({
    success: true,
    data: updatedTable
  });
});

// @desc    Update cell value
// @route   PATCH /api/tables/:tableId/rows/:rowId/cells/:columnId
// @access  Private (Requires EDIT or FULL permission)
const updateCell = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, rowId, columnId } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({
      success: false,
      message: "Cell value is required"
    });
  }

  // Check if user has EDIT or FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'EDIT');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit cells in this table"
    });
  }

  try {
    const updatedTable = await customTableService.updateCell(tableId, rowId, columnId, value);

    res.status(200).json({
      success: true,
      data: updatedTable
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update cell"
    });
  }
});

// @desc    Update cell color
// @route   PATCH /api/tables/:tableId/rows/:rowId/colors/:columnId
// @access  Private (Requires EDIT or FULL permission)
const updateCellColor = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, rowId, columnId } = req.params;
  const { color } = req.body;

  // Validate hex color format if color is provided
  if (color !== null && color !== undefined) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({
        success: false,
        message: "Invalid color format. Must be in hexadecimal format (#RRGGBB)"
      });
    }
  }

  // Check if user has EDIT or FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'EDIT');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit cells in this table"
    });
  }

  try {
    const updatedTable = await customTableService.updateCellColor(tableId, rowId, columnId, color);

    res.status(200).json({
      success: true,
      data: updatedTable
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update cell color"
    });
  }
});

// @desc    Update cell text color
// @route   PATCH /api/tables/:tableId/rows/:rowId/text-colors/:columnId
// @access  Private (Requires EDIT or FULL permission)
const updateCellTextColor = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId, rowId, columnId } = req.params;
  const { color } = req.body;

  // Validate hex color format if color is provided
  if (color !== null && color !== undefined) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({
        success: false,
        message: "Invalid color format. Must be in hexadecimal format (#RRGGBB)"
      });
    }
  }

  // Check if user has EDIT or FULL permission
  const { hasAccess } = await checkTablePermission(tableId, req.user!.id, 'EDIT');
  
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to edit cells in this table"
    });
  }

  try {
    const updatedTable = await customTableService.updateCellTextColor(tableId, rowId, columnId, color);

    res.status(200).json({
      success: true,
      data: updatedTable
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update cell text color"
    });
  }
});

// @desc    Export table to Excel
// @route   GET /api/tables/:tableId/export
// @access  Private
const exportTable = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { tableId } = req.params;

  // Check if user has VIEW permission (minimum)
  const { hasAccess, table } = await checkTablePermission(tableId, req.user!.id, 'VIEW');
  
  if (!hasAccess || !table) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this table"
    });
  }

  try {
    // Generate Excel file
    const buffer = await excelExportService.exportTableToExcel(tableId);
    
    // Set headers for Excel file download
    const filename = `${table.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    // Stream the buffer to response
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportTable] Error exporting table:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to export table. Please try again later."
    });
  }
});

module.exports = {
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
};

export {};
