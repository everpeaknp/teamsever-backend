"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = require("../utils/asyncHandler");
const { TableMember, TablePermissionLevel } = require("../models/TableMember");
const CustomTable = require("../models/CustomTable");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const AppError = require("../utils/AppError");
/**
 * @desc    Get all table members with their permission levels
 * @route   GET /api/tables/:tableId/table-members
 * @access  Private (Member or higher)
 */
const getTableMembers = asyncHandler(async (req, res, next) => {
    console.log('[TableMemberController] getTableMembers called', { tableId: req.params.tableId });
    const { tableId } = req.params;
    const table = await CustomTable.findById(tableId);
    if (!table) {
        return next(new AppError("Table not found", 404));
    }
    // Get workspace from space
    const Space = require("../models/Space");
    const space = await Space.findById(table.spaceId);
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    // Get all table members with overrides
    const tableMembers = await TableMember.find({ table: tableId })
        .populate("user", "name email avatar")
        .populate("addedBy", "name")
        .lean();
    // Get workspace to show all potential members
    const workspace = await Workspace.findById(space.workspace).populate("members.user", "name email avatar");
    // Format response with override info
    // Filter out admins and owners as they have full access by default
    const members = workspace.members
        .filter((member) => member.role === 'member') // Only include regular members
        .map((member) => {
        const override = tableMembers.find((tm) => tm.user._id.toString() === member.user._id.toString());
        return {
            _id: member.user._id,
            name: member.user.name,
            email: member.user.email,
            avatar: member.user.avatar,
            workspaceRole: member.role,
            customRoleTitle: member.customRoleTitle || null,
            tablePermissionLevel: override?.permissionLevel || null,
            hasOverride: !!override,
            addedBy: override?.addedBy?.name || null,
            addedAt: override?.createdAt || null,
        };
    });
    console.log('[TableMemberController] Members retrieved (excluding admins/owners)', { count: members.length });
    res.status(200).json({
        success: true,
        count: members.length,
        data: members,
    });
});
/**
 * @desc    Add or update table member permission override
 * @route   POST /api/tables/:tableId/table-members
 * @access  Private (Admin or Owner)
 */
const addTableMember = asyncHandler(async (req, res, next) => {
    const { tableId } = req.params;
    const { userId, permissionLevel } = req.body;
    const currentUserId = req.user.id;
    console.log('[addTableMember] Request:', { tableId, userId, permissionLevel, currentUserId });
    // Validate permission level
    const validLevels = Object.values(TablePermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    if (!userId) {
        return next(new AppError("User ID is required", 400));
    }
    // Verify table exists
    const table = await CustomTable.findById(tableId);
    if (!table) {
        return next(new AppError("Table not found", 404));
    }
    // Get space and workspace
    const Space = require("../models/Space");
    const space = await Space.findById(table.spaceId);
    if (!space) {
        return next(new AppError("Space not found", 404));
    }
    const workspaceId = space.workspace;
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        return next(new AppError("Workspace not found", 404));
    }
    // Verify user is workspace member
    const isWorkspaceMember = workspace.members.some((m) => m.user.toString() === userId);
    if (!isWorkspaceMember) {
        return next(new AppError("User must be a workspace member first", 400));
    }
    // Check if user is admin or owner - they don't need table permissions
    const workspaceMember = workspace.members.find((m) => m.user.toString() === userId);
    if (workspaceMember && (workspaceMember.role === 'admin' || workspaceMember.role === 'owner')) {
        return next(new AppError("Admins and owners have full access by default and cannot be added to table members", 400));
    }
    // Check if override already exists
    let tableMember = await TableMember.findOne({
        user: userId,
        table: tableId,
    });
    const isNewMember = !tableMember;
    if (tableMember) {
        // Update existing override
        tableMember.permissionLevel = permissionLevel;
        tableMember.addedBy = currentUserId;
        await tableMember.save();
    }
    else {
        // Create new override
        const createData = {
            user: userId,
            table: tableId,
            space: table.spaceId,
            workspace: workspaceId,
            permissionLevel,
            addedBy: currentUserId,
        };
        console.log('[addTableMember] Creating with data:', createData);
        try {
            tableMember = await TableMember.create(createData);
        }
        catch (createError) {
            console.error('[addTableMember] Create error:', createError);
            return next(new AppError(`Failed to create table member: ${createError.message}`, 500));
        }
    }
    // Populate user info
    await tableMember.populate("user", "name email avatar");
    // Create workspace activity for new member addition
    if (isNewMember) {
        try {
            await WorkspaceActivity.createActivity({
                workspace: workspaceId.toString(),
                user: currentUserId,
                type: "table_member_added",
                description: `added ${tableMember.user.name} to table "${table.name}"`,
                space: table.spaceId,
                targetUser: userId,
                metadata: { permissionLevel, tableId }
            });
        }
        catch (error) {
            console.error('[addTableMember] Failed to create workspace activity:', error);
        }
    }
    res.status(200).json({
        success: true,
        message: "Table member permission updated successfully",
        data: {
            _id: tableMember.user._id,
            name: tableMember.user.name,
            email: tableMember.user.email,
            avatar: tableMember.user.avatar,
            permissionLevel: tableMember.permissionLevel,
        },
    });
});
/**
 * @desc    Update table member permission level
 * @route   PATCH /api/tables/:tableId/table-members/:userId
 * @access  Private (Admin or Owner)
 */
const updateTableMember = asyncHandler(async (req, res, next) => {
    const { tableId, userId } = req.params;
    const { permissionLevel } = req.body;
    const currentUserId = req.user.id;
    // Validate permission level
    const validLevels = Object.values(TablePermissionLevel);
    if (!permissionLevel || !validLevels.includes(permissionLevel)) {
        return next(new AppError(`Invalid permission level. Must be one of: ${validLevels.join(", ")}`, 400));
    }
    const tableMember = await TableMember.findOne({
        user: userId,
        table: tableId,
    });
    if (!tableMember) {
        return next(new AppError("Table member override not found", 404));
    }
    tableMember.permissionLevel = permissionLevel;
    tableMember.addedBy = currentUserId;
    await tableMember.save();
    await tableMember.populate("user", "name email avatar");
    res.status(200).json({
        success: true,
        message: "Table member permission updated successfully",
        data: {
            _id: tableMember.user._id,
            name: tableMember.user.name,
            email: tableMember.user.email,
            avatar: tableMember.user.avatar,
            permissionLevel: tableMember.permissionLevel,
        },
    });
});
/**
 * @desc    Remove table member permission override
 * @route   DELETE /api/tables/:tableId/table-members/:userId
 * @access  Private (Admin or Owner)
 */
const removeTableMember = asyncHandler(async (req, res, next) => {
    const { tableId, userId } = req.params;
    const currentUserId = req.user.id;
    const tableMember = await TableMember.findOne({
        user: userId,
        table: tableId,
    }).populate("user", "name");
    if (!tableMember) {
        return next(new AppError("Table member override not found", 404));
    }
    // Get table info for activity
    const table = await CustomTable.findById(tableId);
    const userName = tableMember.user?.name || 'a member';
    await TableMember.findOneAndDelete({
        user: userId,
        table: tableId,
    });
    // Create workspace activity
    if (table) {
        try {
            const Space = require("../models/Space");
            const space = await Space.findById(table.spaceId);
            await WorkspaceActivity.createActivity({
                workspace: space.workspace.toString(),
                user: currentUserId,
                type: "table_member_removed",
                description: `removed ${userName} from table "${table.name}"`,
                space: table.spaceId.toString(),
                targetUser: userId,
                metadata: { tableId }
            });
        }
        catch (error) {
            console.error('[removeTableMember] Failed to create workspace activity:', error);
        }
    }
    res.status(200).json({
        success: true,
        message: "Table member permission override removed successfully",
    });
});
module.exports = {
    getTableMembers,
    addTableMember,
    updateTableMember,
    removeTableMember,
};
