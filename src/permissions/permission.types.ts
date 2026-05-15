/**
 * Permission Types
 * Centralized type definitions for the RBAC system
 */

/**
 * Workspace roles in hierarchical order
 */
export enum WorkspaceRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  GUEST = "guest"
}

/**
 * Space permission levels for fine-grained access control
 */
export enum SpacePermissionLevel {
  FULL = "FULL",       // Full access to space
  EDIT = "EDIT",       // Can create and edit
  COMMENT = "COMMENT", // Can only comment
  VIEW = "VIEW"        // Read-only
}

/**
 * Folder permission levels for fine-grained access control
 */
export enum FolderPermissionLevel {
  FULL = "FULL",       // Full access to folder
  EDIT = "EDIT",       // Can create and edit
  COMMENT = "COMMENT", // Can only comment
  VIEW = "VIEW"        // Read-only
}

/**
 * List permission levels for fine-grained access control
 */
export enum ListPermissionLevel {
  FULL = "FULL",       // Full access to list
  EDIT = "EDIT",       // Can create and edit
  COMMENT = "COMMENT", // Can only comment
  VIEW = "VIEW"        // Read-only
}

/**
 * All possible actions in the system
 */
export type PermissionAction =
  // Workspace actions
  | "DELETE_WORKSPACE"
  | "UPDATE_WORKSPACE"
  | "INVITE_MEMBER"
  | "REMOVE_MEMBER"
  | "CHANGE_MEMBER_ROLE"
  | "VIEW_WORKSPACE"
  | "LEAVE_WORKSPACE"
  
  // Space actions
  | "CREATE_SPACE"
  | "DELETE_SPACE"
  | "UPDATE_SPACE"
  | "VIEW_SPACE"
  | "ADD_SPACE_MEMBER"
  | "REMOVE_SPACE_MEMBER"
  | "MANAGE_SPACE_PERMISSIONS"
  
  // Folder actions
  | "CREATE_FOLDER"
  | "DELETE_FOLDER"
  | "UPDATE_FOLDER"
  | "VIEW_FOLDER"
  
  // List actions
  | "CREATE_LIST"
  | "DELETE_LIST"
  | "UPDATE_LIST"
  | "VIEW_LIST"
  
  // Task actions
  | "CREATE_TASK"
  | "DELETE_TASK"
  | "EDIT_TASK"
  | "VIEW_TASK"
  | "ASSIGN_TASK"
  | "CHANGE_STATUS"
  | "COMMENT_TASK"
  
  // Settings and analytics
  | "MANAGE_SETTINGS"
  | "VIEW_ANALYTICS"
  | "VIEW_ACTIVITY_LOG";

/**
 * Context for permission checking
 * Contains information about the resource being accessed
 */
export interface PermissionContext {
  workspaceId: string;
  userId: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
  resourceId?: string;
  resourceType?: "workspace" | "space" | "folder" | "list" | "task";
  assigneeId?: string; // For task-specific permissions
}

/**
 * Workspace member interface
 */
export interface WorkspaceMember {
  user: string;
  role: WorkspaceRole;
}

export {};
