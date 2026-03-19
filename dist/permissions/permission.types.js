"use strict";
/**
 * Permission Types
 * Centralized type definitions for the RBAC system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPermissionLevel = exports.FolderPermissionLevel = exports.SpacePermissionLevel = exports.WorkspaceRole = void 0;
/**
 * Workspace roles in hierarchical order
 */
var WorkspaceRole;
(function (WorkspaceRole) {
    WorkspaceRole["OWNER"] = "owner";
    WorkspaceRole["ADMIN"] = "admin";
    WorkspaceRole["MEMBER"] = "member";
    WorkspaceRole["GUEST"] = "guest";
})(WorkspaceRole || (exports.WorkspaceRole = WorkspaceRole = {}));
/**
 * Space permission levels for fine-grained access control
 */
var SpacePermissionLevel;
(function (SpacePermissionLevel) {
    SpacePermissionLevel["FULL"] = "FULL";
    SpacePermissionLevel["EDIT"] = "EDIT";
    SpacePermissionLevel["COMMENT"] = "COMMENT";
    SpacePermissionLevel["VIEW"] = "VIEW"; // Read-only
})(SpacePermissionLevel || (exports.SpacePermissionLevel = SpacePermissionLevel = {}));
/**
 * Folder permission levels for fine-grained access control
 */
var FolderPermissionLevel;
(function (FolderPermissionLevel) {
    FolderPermissionLevel["FULL"] = "FULL";
    FolderPermissionLevel["EDIT"] = "EDIT";
    FolderPermissionLevel["COMMENT"] = "COMMENT";
    FolderPermissionLevel["VIEW"] = "VIEW"; // Read-only
})(FolderPermissionLevel || (exports.FolderPermissionLevel = FolderPermissionLevel = {}));
/**
 * List permission levels for fine-grained access control
 */
var ListPermissionLevel;
(function (ListPermissionLevel) {
    ListPermissionLevel["FULL"] = "FULL";
    ListPermissionLevel["EDIT"] = "EDIT";
    ListPermissionLevel["COMMENT"] = "COMMENT";
    ListPermissionLevel["VIEW"] = "VIEW"; // Read-only
})(ListPermissionLevel || (exports.ListPermissionLevel = ListPermissionLevel = {}));
