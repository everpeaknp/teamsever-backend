"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWorkspaceMember = exports.checkWorkspaceAdmin = exports.checkWorkspaceOwner = exports.checkMinRole = exports.checkWorkspaceRole = void 0;
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const Task = require("../models/Task");
const AppError = require("../utils/AppError");
/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY = {
    guest: 0,
    member: 1,
    admin: 2,
    owner: 3,
};
/**
 * Check if user has required role in workspace
 * @param allowedRoles - Array of roles that are allowed to access the route
 * @returns Middleware function
 */
const checkWorkspaceRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new AppError("Authentication required", 401));
            }
            // Get workspace ID from params - check workspaceId or id for workspace routes
            let workspaceId = req.params.workspaceId;
            // For /api/workspaces/:id routes, the :id param IS the workspaceId
            if (!workspaceId && req.path.match(/^\/[^\/]+$/) && req.baseUrl === '/api/workspaces') {
                workspaceId = req.params.id;
            }
            // If not directly in params, try to get from space/list/task
            if (!workspaceId) {
                // Check for spaceId or id (for space routes)
                // For /api/spaces/:id, req.params.id is the spaceId and baseUrl is /api/spaces
                const spaceId = req.params.spaceId ||
                    (req.baseUrl === '/api/spaces' && req.params.id) ||
                    (req.path.includes('/spaces/') && req.params.id);
                if (spaceId) {
                    console.log(`[checkRole] Looking up space with ID: ${spaceId}`);
                    const space = await Space.findById(spaceId).select('workspace');
                    if (!space) {
                        console.error(`[checkRole] Space not found with ID: ${spaceId}`);
                        return next(new AppError("Space not found", 404));
                    }
                    console.log(`[checkRole] Found space, workspace ID: ${space.workspace}`);
                    workspaceId = space.workspace.toString();
                }
                else if (req.params.listId ||
                    (req.baseUrl === '/api/lists' && req.params.id) ||
                    (req.path.includes('/lists/') && req.params.id)) {
                    const listId = req.params.listId || req.params.id;
                    const list = await List.findById(listId).select('workspace');
                    if (!list) {
                        return next(new AppError("List not found", 404));
                    }
                    workspaceId = list.workspace.toString();
                }
                else if (req.params.taskId ||
                    (req.baseUrl === '/api/tasks' && req.params.id) ||
                    (req.path.includes('/tasks/') && req.params.id)) {
                    const taskId = req.params.taskId || req.params.id;
                    const task = await Task.findById(taskId).select('workspace');
                    if (!task) {
                        return next(new AppError("Task not found", 404));
                    }
                    workspaceId = task.workspace.toString();
                }
            }
            if (!workspaceId) {
                console.error('[checkRole] No workspace ID found in params:', req.params);
                return next(new AppError("Workspace ID not found", 400));
            }
            // Find workspace and check user's role
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                return next(new AppError("Workspace not found", 404));
            }
            // Check if user is workspace owner first
            if (workspace.owner.toString() === userId) {
                // Owner has all permissions
                req.workspace = workspace;
                req.userRole = 'owner';
                return next();
            }
            // Check if user is a member
            const member = workspace.members.find((m) => m.user.toString() === userId);
            if (!member) {
                return next(new AppError("You are not a member of this workspace", 403));
            }
            // Check if user's role is in allowed roles
            const userRole = member.role;
            const hasPermission = allowedRoles.includes(userRole);
            if (!hasPermission) {
                return next(new AppError(`Insufficient permissions. Required role: ${allowedRoles.join(" or ")}. Your role: ${userRole}`, 403));
            }
            // Attach workspace and user role to request for use in controllers
            req.workspace = workspace;
            req.userRole = userRole;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.checkWorkspaceRole = checkWorkspaceRole;
/**
 * Check if user has minimum required role level
 * @param minRole - Minimum role required (e.g., 'admin' allows admin and owner)
 * @returns Middleware function
 */
const checkMinRole = (minRole) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new AppError("Authentication required", 401));
            }
            let workspaceId = req.params.workspaceId;
            // For /api/workspaces/:id routes, the :id param IS the workspaceId
            if (!workspaceId && req.path.match(/^\/[^\/]+$/) && req.baseUrl === '/api/workspaces') {
                workspaceId = req.params.id;
            }
            // Get workspace ID from related resources if not in params
            if (!workspaceId) {
                // Check for spaceId or id (for space routes)
                // For /api/spaces/:id, req.params.id is the spaceId and baseUrl is /api/spaces
                const spaceId = req.params.spaceId ||
                    (req.baseUrl === '/api/spaces' && req.params.id) ||
                    (req.path.includes('/spaces/') && req.params.id);
                if (spaceId) {
                    const space = await Space.findById(spaceId).select('workspace');
                    if (space) {
                        workspaceId = space.workspace.toString();
                    }
                }
                else if (req.params.listId ||
                    (req.baseUrl === '/api/lists' && req.params.id) ||
                    (req.path.includes('/lists/') && req.params.id)) {
                    const listId = req.params.listId || req.params.id;
                    const list = await List.findById(listId).select('workspace');
                    if (list) {
                        workspaceId = list.workspace.toString();
                    }
                }
                else if (req.params.taskId ||
                    (req.baseUrl === '/api/tasks' && req.params.id) ||
                    (req.path.includes('/tasks/') && req.params.id)) {
                    const taskId = req.params.taskId || req.params.id;
                    const task = await Task.findById(taskId).select('workspace');
                    if (task) {
                        workspaceId = task.workspace.toString();
                    }
                }
            }
            if (!workspaceId) {
                console.error('[checkMinRole] No workspace ID found in params:', req.params);
                return next(new AppError("Workspace ID not found", 400));
            }
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                return next(new AppError("Workspace not found", 404));
            }
            // Check if user is workspace owner first
            if (workspace.owner.toString() === userId) {
                // Owner has all permissions
                req.workspace = workspace;
                req.userRole = 'owner';
                return next();
            }
            const member = workspace.members.find((m) => m.user.toString() === userId);
            if (!member) {
                return next(new AppError("You are not a member of this workspace", 403));
            }
            const userRole = member.role;
            const minRoleLevel = ROLE_HIERARCHY[minRole];
            const userRoleLevel = ROLE_HIERARCHY[userRole];
            if (userRoleLevel < minRoleLevel) {
                return next(new AppError(`Insufficient permissions. Required: ${minRole} or higher. Your role: ${userRole}`, 403));
            }
            req.workspace = workspace;
            req.userRole = userRole;
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.checkMinRole = checkMinRole;
/**
 * Check if user is workspace owner
 */
const checkWorkspaceOwner = () => {
    return (0, exports.checkWorkspaceRole)(['owner']);
};
exports.checkWorkspaceOwner = checkWorkspaceOwner;
/**
 * Check if user is admin or owner
 */
const checkWorkspaceAdmin = () => {
    return (0, exports.checkMinRole)('admin');
};
exports.checkWorkspaceAdmin = checkWorkspaceAdmin;
/**
 * Check if user is a member (any role)
 */
const checkWorkspaceMember = () => {
    return (0, exports.checkMinRole)('guest');
};
exports.checkWorkspaceMember = checkWorkspaceMember;
module.exports = {
    checkWorkspaceRole: exports.checkWorkspaceRole,
    checkMinRole: exports.checkMinRole,
    checkWorkspaceOwner: exports.checkWorkspaceOwner,
    checkWorkspaceAdmin: exports.checkWorkspaceAdmin,
    checkWorkspaceMember: exports.checkWorkspaceMember,
};
