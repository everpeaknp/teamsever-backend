"use strict";
/**
 * Permission Constants
 * Defines the permission matrix for each role
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIST_PERMISSION_ACTIONS = exports.FOLDER_PERMISSION_ACTIONS = exports.ROLE_PERMISSIONS = exports.SPACE_PERMISSION_ACTIONS = exports.LIST_PERMISSION_HIERARCHY = exports.FOLDER_PERMISSION_HIERARCHY = exports.SPACE_PERMISSION_HIERARCHY = exports.ROLE_HIERARCHY = void 0;
exports.roleHasPermission = roleHasPermission;
exports.spacePermissionHasAction = spacePermissionHasAction;
exports.folderPermissionHasAction = folderPermissionHasAction;
exports.listPermissionHasAction = listPermissionHasAction;
exports.roleHasMinLevel = roleHasMinLevel;
const permission_types_1 = require("./permission.types");
/**
 * Role hierarchy levels (higher = more permissions)
 */
exports.ROLE_HIERARCHY = {
    [permission_types_1.WorkspaceRole.GUEST]: 0,
    [permission_types_1.WorkspaceRole.MEMBER]: 1,
    [permission_types_1.WorkspaceRole.ADMIN]: 2,
    [permission_types_1.WorkspaceRole.OWNER]: 3,
};
/**
 * Space Permission Level hierarchy (higher = more permissions)
 */
exports.SPACE_PERMISSION_HIERARCHY = {
    [permission_types_1.SpacePermissionLevel.VIEW]: 0,
    [permission_types_1.SpacePermissionLevel.COMMENT]: 1,
    [permission_types_1.SpacePermissionLevel.EDIT]: 2,
    [permission_types_1.SpacePermissionLevel.FULL]: 3,
};
/**
 * Folder Permission Level hierarchy (higher = more permissions)
 */
exports.FOLDER_PERMISSION_HIERARCHY = {
    [permission_types_1.FolderPermissionLevel.VIEW]: 0,
    [permission_types_1.FolderPermissionLevel.COMMENT]: 1,
    [permission_types_1.FolderPermissionLevel.EDIT]: 2,
    [permission_types_1.FolderPermissionLevel.FULL]: 3,
};
/**
 * List Permission Level hierarchy (higher = more permissions)
 */
exports.LIST_PERMISSION_HIERARCHY = {
    [permission_types_1.ListPermissionLevel.VIEW]: 0,
    [permission_types_1.ListPermissionLevel.COMMENT]: 1,
    [permission_types_1.ListPermissionLevel.EDIT]: 2,
    [permission_types_1.ListPermissionLevel.FULL]: 3,
};
/**
 * Space Permission Level Matrix
 * Defines which actions are allowed for each space permission level
 */
exports.SPACE_PERMISSION_ACTIONS = {
    [permission_types_1.SpacePermissionLevel.FULL]: [
        // Space
        "UPDATE_SPACE",
        "VIEW_SPACE",
        // Folder
        "CREATE_FOLDER",
        "DELETE_FOLDER",
        "UPDATE_FOLDER",
        "VIEW_FOLDER",
        // List
        "CREATE_LIST",
        "DELETE_LIST",
        "UPDATE_LIST",
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "DELETE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "ASSIGN_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.SpacePermissionLevel.EDIT]: [
        // Space
        "VIEW_SPACE",
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.SpacePermissionLevel.COMMENT]: [
        // Space
        "VIEW_SPACE",
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
        "COMMENT_TASK",
    ],
    [permission_types_1.SpacePermissionLevel.VIEW]: [
        // Space
        "VIEW_SPACE",
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
    ],
};
/**
 * Permission matrix: defines which roles can perform which actions
 */
exports.ROLE_PERMISSIONS = {
    [permission_types_1.WorkspaceRole.OWNER]: [
        // Workspace
        "DELETE_WORKSPACE",
        "UPDATE_WORKSPACE",
        "INVITE_MEMBER",
        "REMOVE_MEMBER",
        "CHANGE_MEMBER_ROLE",
        "VIEW_WORKSPACE",
        "LEAVE_WORKSPACE",
        // Space
        "CREATE_SPACE",
        "DELETE_SPACE",
        "UPDATE_SPACE",
        "VIEW_SPACE",
        "ADD_SPACE_MEMBER",
        "REMOVE_SPACE_MEMBER",
        "MANAGE_SPACE_PERMISSIONS",
        // Folder
        "CREATE_FOLDER",
        "DELETE_FOLDER",
        "UPDATE_FOLDER",
        "VIEW_FOLDER",
        // List
        "CREATE_LIST",
        "DELETE_LIST",
        "UPDATE_LIST",
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "DELETE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "ASSIGN_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Settings
        "MANAGE_SETTINGS",
        "VIEW_ANALYTICS",
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.WorkspaceRole.ADMIN]: [
        // Workspace
        "INVITE_MEMBER",
        "REMOVE_MEMBER",
        "VIEW_WORKSPACE",
        "LEAVE_WORKSPACE",
        // Space
        "CREATE_SPACE",
        "DELETE_SPACE",
        "UPDATE_SPACE",
        "VIEW_SPACE",
        "ADD_SPACE_MEMBER",
        "REMOVE_SPACE_MEMBER",
        "MANAGE_SPACE_PERMISSIONS",
        // Folder
        "CREATE_FOLDER",
        "DELETE_FOLDER",
        "UPDATE_FOLDER",
        "VIEW_FOLDER",
        // List
        "CREATE_LIST",
        "DELETE_LIST",
        "UPDATE_LIST",
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "DELETE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "ASSIGN_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Settings
        "VIEW_ANALYTICS",
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.WorkspaceRole.MEMBER]: [
        // Workspace
        "VIEW_WORKSPACE",
        "LEAVE_WORKSPACE",
        // Space - Members can only view spaces (must be added to space for more access)
        "VIEW_SPACE",
        // Folder - No access unless added to space
        "VIEW_FOLDER",
        // List - No access unless added to space
        "VIEW_LIST",
        // Task - No access unless added to space
        "VIEW_TASK",
        "COMMENT_TASK",
        // Settings
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.WorkspaceRole.GUEST]: [
        // Workspace
        "VIEW_WORKSPACE",
        // Space
        "VIEW_SPACE",
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
        "COMMENT_TASK",
    ],
};
/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, action) {
    return exports.ROLE_PERMISSIONS[role].includes(action);
}
/**
 * Check if a space permission level has a specific permission
 */
function spacePermissionHasAction(level, action) {
    return exports.SPACE_PERMISSION_ACTIONS[level].includes(action);
}
/**
 * Folder Permission Level Matrix
 * Defines which actions are allowed for each folder permission level
 */
exports.FOLDER_PERMISSION_ACTIONS = {
    [permission_types_1.FolderPermissionLevel.FULL]: [
        // Folder
        "UPDATE_FOLDER",
        "VIEW_FOLDER",
        // List
        "CREATE_LIST",
        "DELETE_LIST",
        "UPDATE_LIST",
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "DELETE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "ASSIGN_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.FolderPermissionLevel.EDIT]: [
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.FolderPermissionLevel.COMMENT]: [
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
        "COMMENT_TASK",
    ],
    [permission_types_1.FolderPermissionLevel.VIEW]: [
        // Folder
        "VIEW_FOLDER",
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
    ],
};
/**
 * List Permission Level Matrix
 * Defines which actions are allowed for each list permission level
 */
exports.LIST_PERMISSION_ACTIONS = {
    [permission_types_1.ListPermissionLevel.FULL]: [
        // List
        "UPDATE_LIST",
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "DELETE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "ASSIGN_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.ListPermissionLevel.EDIT]: [
        // List
        "VIEW_LIST",
        // Task
        "CREATE_TASK",
        "EDIT_TASK",
        "VIEW_TASK",
        "CHANGE_STATUS",
        "COMMENT_TASK",
        // Activity
        "VIEW_ACTIVITY_LOG",
    ],
    [permission_types_1.ListPermissionLevel.COMMENT]: [
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
        "COMMENT_TASK",
    ],
    [permission_types_1.ListPermissionLevel.VIEW]: [
        // List
        "VIEW_LIST",
        // Task
        "VIEW_TASK",
    ],
};
/**
 * Check if a folder permission level has a specific permission
 */
function folderPermissionHasAction(level, action) {
    return exports.FOLDER_PERMISSION_ACTIONS[level].includes(action);
}
/**
 * Check if a list permission level has a specific permission
 */
function listPermissionHasAction(level, action) {
    return exports.LIST_PERMISSION_ACTIONS[level].includes(action);
}
/**
 * Check if a role meets minimum level requirement
 */
function roleHasMinLevel(role, minRole) {
    return exports.ROLE_HIERARCHY[role] >= exports.ROLE_HIERARCHY[minRole];
}
