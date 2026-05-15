/**
 * Permission Constants
 * Defines the permission matrix for each role
 */

import { WorkspaceRole, PermissionAction, SpacePermissionLevel, FolderPermissionLevel, ListPermissionLevel } from "./permission.types";

/**
 * Role hierarchy levels (higher = more permissions)
 */
export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  [WorkspaceRole.GUEST]: 0,
  [WorkspaceRole.MEMBER]: 1,
  [WorkspaceRole.ADMIN]: 2,
  [WorkspaceRole.OWNER]: 3,
};

/**
 * Space Permission Level hierarchy (higher = more permissions)
 */
export const SPACE_PERMISSION_HIERARCHY: Record<SpacePermissionLevel, number> = {
  [SpacePermissionLevel.VIEW]: 0,
  [SpacePermissionLevel.COMMENT]: 1,
  [SpacePermissionLevel.EDIT]: 2,
  [SpacePermissionLevel.FULL]: 3,
};

/**
 * Folder Permission Level hierarchy (higher = more permissions)
 */
export const FOLDER_PERMISSION_HIERARCHY: Record<FolderPermissionLevel, number> = {
  [FolderPermissionLevel.VIEW]: 0,
  [FolderPermissionLevel.COMMENT]: 1,
  [FolderPermissionLevel.EDIT]: 2,
  [FolderPermissionLevel.FULL]: 3,
};

/**
 * List Permission Level hierarchy (higher = more permissions)
 */
export const LIST_PERMISSION_HIERARCHY: Record<ListPermissionLevel, number> = {
  [ListPermissionLevel.VIEW]: 0,
  [ListPermissionLevel.COMMENT]: 1,
  [ListPermissionLevel.EDIT]: 2,
  [ListPermissionLevel.FULL]: 3,
};

/**
 * Space Permission Level Matrix
 * Defines which actions are allowed for each space permission level
 */
export const SPACE_PERMISSION_ACTIONS: Record<SpacePermissionLevel, PermissionAction[]> = {
  [SpacePermissionLevel.FULL]: [
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

  [SpacePermissionLevel.EDIT]: [
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

  [SpacePermissionLevel.COMMENT]: [
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

  [SpacePermissionLevel.VIEW]: [
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
export const ROLE_PERMISSIONS: Record<WorkspaceRole, PermissionAction[]> = {
  [WorkspaceRole.OWNER]: [
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

  [WorkspaceRole.ADMIN]: [
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

  [WorkspaceRole.MEMBER]: [
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

  [WorkspaceRole.GUEST]: [
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
export function roleHasPermission(
  role: WorkspaceRole,
  action: PermissionAction
): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

/**
 * Check if a space permission level has a specific permission
 */
export function spacePermissionHasAction(
  level: SpacePermissionLevel,
  action: PermissionAction
): boolean {
  return SPACE_PERMISSION_ACTIONS[level].includes(action);
}

/**
 * Folder Permission Level Matrix
 * Defines which actions are allowed for each folder permission level
 */
export const FOLDER_PERMISSION_ACTIONS: Record<FolderPermissionLevel, PermissionAction[]> = {
  [FolderPermissionLevel.FULL]: [
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

  [FolderPermissionLevel.EDIT]: [
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

  [FolderPermissionLevel.COMMENT]: [
    // Folder
    "VIEW_FOLDER",
    
    // List
    "VIEW_LIST",
    
    // Task
    "VIEW_TASK",
    "COMMENT_TASK",
  ],

  [FolderPermissionLevel.VIEW]: [
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
export const LIST_PERMISSION_ACTIONS: Record<ListPermissionLevel, PermissionAction[]> = {
  [ListPermissionLevel.FULL]: [
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

  [ListPermissionLevel.EDIT]: [
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

  [ListPermissionLevel.COMMENT]: [
    // List
    "VIEW_LIST",
    
    // Task
    "VIEW_TASK",
    "COMMENT_TASK",
  ],

  [ListPermissionLevel.VIEW]: [
    // List
    "VIEW_LIST",
    
    // Task
    "VIEW_TASK",
  ],
};

/**
 * Check if a folder permission level has a specific permission
 */
export function folderPermissionHasAction(
  level: FolderPermissionLevel,
  action: PermissionAction
): boolean {
  return FOLDER_PERMISSION_ACTIONS[level].includes(action);
}

/**
 * Check if a list permission level has a specific permission
 */
export function listPermissionHasAction(
  level: ListPermissionLevel,
  action: PermissionAction
): boolean {
  return LIST_PERMISSION_ACTIONS[level].includes(action);
}

/**
 * Check if a role meets minimum level requirement
 */
export function roleHasMinLevel(
  role: WorkspaceRole,
  minRole: WorkspaceRole
): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export {};
