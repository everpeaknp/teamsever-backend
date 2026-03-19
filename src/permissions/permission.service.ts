/**
 * Permission Service
 * Centralized permission checking logic with hierarchical overrides
 * 
 * Resolution Order:
 * 1. Owner Bypass → Always has full access
 * 2. List Override → If listId provided, check ListMember
 * 3. Folder Override → If folderId provided (and no list override), check FolderMember
 * 4. Space Override → If spaceId provided (and no folder/list override), check SpaceMember
 * 5. Workspace Role → Fallback to workspace-level RBAC
 * 6. Task-Specific Rules → Assignee checks for certain actions
 */

import {
  WorkspaceRole,
  SpacePermissionLevel,
  FolderPermissionLevel,
  ListPermissionLevel,
  PermissionAction,
  PermissionContext
} from "./permission.types";
const { 
  roleHasPermission, 
  spacePermissionHasAction,
  folderPermissionHasAction,
  listPermissionHasAction
} = require("./permission.constants");

const Workspace = require("../models/Workspace");
const SpaceMember = require("../models/SpaceMember");
const FolderMember = require("../models/FolderMember");
const { ListMember } = require("../models/ListMember");
const Task = require("../models/Task");

class PermissionService {
  /**
   * Check if a user can perform an action
   * 
   * Resolution Order:
   * 1. If user is OWNER → return true (bypass all checks)
   * 2. If listId provided → check ListMember override
   * 3. If no list override and folderId provided → check FolderMember override
   * 4. If no folder override and spaceId provided → check SpaceMember override
   * 5. If no overrides → fallback to workspace role
   * 6. Apply task-specific rules (assignee check)
   * 
   * @param userId - User ID
   * @param action - Permission action to check
   * @param context - Context containing workspaceId and optional spaceId/folderId/listId
   * @returns Promise<boolean>
   */
  async can(
    userId: string,
    action: PermissionAction,
    context: PermissionContext
  ): Promise<boolean> {
    try {
      console.log('\n========================================');
      console.log('🔍 PERMISSION CHECK STARTED');
      console.log('========================================');
      console.log('📋 Details:');
      console.log('  - User ID:', userId);
      console.log('  - Action:', action);
      console.log('  - Workspace ID:', context.workspaceId);
      console.log('  - List ID:', context.listId);
      console.log('  - Resource Type:', context.resourceType);
      console.log('  - Resource ID:', context.resourceId);
      
      // Step 1: Check if user is workspace owner (bypass all checks)
      console.log('\n🔎 Step 1: Checking if user is OWNER...');
      const isOwner = await this.isOwner(userId, context.workspaceId);
      console.log('  ➜ Is Owner?', isOwner);
      
      if (isOwner) {
        console.log('✅ PERMISSION GRANTED - User is OWNER');
        console.log('========================================\n');
        return true;
      }

      // Step 2: Get user's workspace role
      console.log('\n🔎 Step 2: Getting user workspace role...');
      const workspaceRole = await this.getUserRole(userId, context.workspaceId);
      console.log('  ➜ Workspace Role:', workspaceRole);
      console.log('  ➜ Role Type:', typeof workspaceRole);
      
      if (!workspaceRole) {
        console.log('❌ PERMISSION DENIED - No workspace role found');
        console.log('========================================\n');
        return false;
      }

      // Step 2.5: Check if user is admin (bypass list/folder/space overrides and task-specific rules)
      console.log('\n🔎 Step 2.5: Checking if user is ADMIN...');
      console.log('  ➜ workspaceRole value:', JSON.stringify(workspaceRole));
      console.log('  ➜ WorkspaceRole.ADMIN value:', JSON.stringify(WorkspaceRole.ADMIN));
      console.log('  ➜ Strict equality (===):', workspaceRole === WorkspaceRole.ADMIN);
      console.log('  ➜ Loose equality (==):', workspaceRole == WorkspaceRole.ADMIN);
      console.log('  ➜ String comparison:', String(workspaceRole) === String(WorkspaceRole.ADMIN));
      
      if (workspaceRole === WorkspaceRole.ADMIN) {
        console.log('✅ PERMISSION GRANTED - User is ADMIN');
        console.log('========================================\n');
        // Admins have full access to everything
        return true;
      }
      
      console.log('  ➜ User is NOT admin, continuing checks...');

      // Step 3: Check for list-level override (highest priority for non-admins)
      if (context.listId) {
        const listPermission = await this.getListPermissionLevel(
          userId,
          context.listId
        );

        if (listPermission) {
          // List override exists - use it (no additional task checks needed)
          const hasListPermission = listPermissionHasAction(listPermission, action);
          return hasListPermission;
        }
      }

      // Step 4: Check for folder-level override (second priority)
      if (context.folderId) {
        const folderPermission = await this.getFolderPermissionLevel(
          userId,
          context.folderId
        );

        if (folderPermission) {
          // Folder override exists - use it (no additional task checks needed)
          return folderPermissionHasAction(folderPermission, action);
        }
      }

      // Step 5: Check for space-level override (third priority)
      if (context.spaceId) {
        const spacePermission = await this.getSpacePermissionLevel(
          userId,
          context.spaceId
        );

        if (spacePermission) {
          // Space override exists - use it (no additional task checks needed)
          return spacePermissionHasAction(spacePermission, action);
        }
        
        // Only enforce space membership restriction
        // IF there is NO list override and NO folder override
        if (
          !context.listId &&
          !context.folderId &&
          this.isSpaceAction(action) &&
          workspaceRole === WorkspaceRole.MEMBER
        ) {
          const isSpaceMember = await this.isSpaceMember(userId, context.spaceId);
          if (!isSpaceMember) {
            const viewActions: PermissionAction[] = [
              "VIEW_SPACE",
              "VIEW_FOLDER",
              "VIEW_LIST",
              "VIEW_TASK",
              "COMMENT_TASK",
            ];
            return viewActions.includes(action);
          }
        }
      }

      // Step 6: No overrides - use workspace role
      console.log('\n🔎 Step 6: Checking workspace role permissions...');
      const hasWorkspacePermission = roleHasPermission(workspaceRole, action);
      console.log('  ➜ Has workspace permission?', hasWorkspacePermission);
      
      if (!hasWorkspacePermission) {
        // Step 7: Apply task-specific rules (assignee check as fallback)
        if (this.isTaskAction(action) && context.resourceType === "task") {
          console.log('\n🔎 Step 7: Checking task-specific permissions...');
          const result = await this.checkTaskPermission(
            userId,
            action,
            context,
            workspaceRole
          );
          console.log('  ➜ Task permission result:', result);
          if (result) {
            console.log('✅ PERMISSION GRANTED - Task-specific rule');
          } else {
            console.log('❌ PERMISSION DENIED - No task-specific permission');
          }
          console.log('========================================\n');
          return result;
        }
        console.log('❌ PERMISSION DENIED - No workspace permission');
        console.log('========================================\n');
        return false;
      }

      console.log('✅ PERMISSION GRANTED - Workspace role permission');
      console.log('========================================\n');
      return true;
    } catch (error) {
      console.error("[PermissionService] ❌ Error checking permission:", error);
      console.log('========================================\n');
      return false;
    }
  }

  /**
   * Get user's role in a workspace
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns Promise<WorkspaceRole | null>
   */
  async getUserRole(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceRole | null> {
    try {
      console.log('  📂 Fetching workspace data...');
      const workspace = await Workspace.findById(workspaceId).select(
        "owner members"
      );

      if (!workspace) {
        console.log('  ❌ Workspace not found!');
        return null;
      }
      
      console.log('  ✓ Workspace found');
      console.log('  ➜ Owner ID:', workspace.owner.toString());

      // Check if user is owner
      if (workspace.owner.toString() === userId) {
        console.log('  ✓ User matches owner ID');
        return WorkspaceRole.OWNER;
      }

      // Find user in members
      console.log('  📋 Searching in members array...');
      console.log('  ➜ Total members:', workspace.members.length);
      
      const member = workspace.members.find(
        (m: any) => m.user.toString() === userId
      );

      if (!member) {
        console.log('  ❌ User not found in members array');
        return null;
      }

      console.log('  ✓ User found in members!');
      console.log('  ➜ Raw role from DB:', member.role);
      console.log('  ➜ Role type:', typeof member.role);
      
      // Convert to normalized enum value
      const normalizedRole = this.normalizeRole(member.role);
      console.log('  ➜ Normalized role:', normalizedRole);
      console.log('  ➜ Normalized type:', typeof normalizedRole);
      
      return normalizedRole;
    } catch (error) {
      console.error("[PermissionService] ❌ Error getting user role:", error);
      return null;
    }
  }

  /**
   * Get user's space permission level (override)
   * @param userId - User ID
   * @param spaceId - Space ID
   * @returns Promise<SpacePermissionLevel | null>
   */
  async getSpacePermissionLevel(
    userId: string,
    spaceId: string
  ): Promise<SpacePermissionLevel | null> {
    try {
      const spaceMember = await SpaceMember.findOne({
        user: userId,
        space: spaceId
      }).select("permissionLevel");

      if (!spaceMember) {
        return null;
      }

      return spaceMember.permissionLevel;
    } catch (error) {
      console.error("[PermissionService] Error getting space permission:", error);
      return null;
    }
  }

  /**
   * Get user's folder permission level (override)
   * @param userId - User ID
   * @param folderId - Folder ID
   * @returns Promise<FolderPermissionLevel | null>
   */
  async getFolderPermissionLevel(
    userId: string,
    folderId: string
  ): Promise<FolderPermissionLevel | null> {
    try {
      const folderMember = await FolderMember.findOne({
        user: userId,
        folder: folderId
      }).select("permissionLevel");

      if (!folderMember) {
        return null;
      }

      return folderMember.permissionLevel;
    } catch (error) {
      console.error("[PermissionService] Error getting folder permission:", error);
      return null;
    }
  }

  /**
   * Get user's list permission level (override)
   * @param userId - User ID
   * @param listId - List ID
   * @returns Promise<ListPermissionLevel | null>
   */
  async getListPermissionLevel(
    userId: string,
    listId: string
  ): Promise<ListPermissionLevel | null> {
    try {
      const listMember = await ListMember.findOne({
        user: userId,
        list: listId
      }).select("permissionLevel");

      if (!listMember) {
        return null;
      }

      return listMember.permissionLevel;
    } catch (error) {
      console.error("[PermissionService] Error getting list permission:", error);
      return null;
    }
  }

  /**
   * Get user's table permission level (override)
   * @param userId - User ID
   * @param tableId - Table ID
   * @returns Promise<TablePermissionLevel | null>
   */
  async getTablePermissionLevel(
    userId: string,
    tableId: string
  ): Promise<string | null> {
    try {
      const { TableMember } = require("../models/TableMember");
      const tableMember = await TableMember.findOne({
        user: userId,
        table: tableId
      }).select("permissionLevel");

      if (!tableMember) {
        return null;
      }

      return tableMember.permissionLevel;
    } catch (error) {
      console.error("[PermissionService] Error getting table permission:", error);
      return null;
    }
  }

  /**
   * Check if user can access table (is assigned or is admin/owner)
   * @param userId - User ID
   * @param tableId - Table ID
   * @param workspaceId - Workspace ID
   * @returns Promise<boolean>
   */
  async canAccessTable(
    userId: string,
    tableId: string,
    workspaceId: string
  ): Promise<boolean> {
    try {
      // Check if user is admin or owner
      const isAdminOrOwner = await this.isAdminOrOwner(userId, workspaceId);
      if (isAdminOrOwner) {
        return true;
      }

      // Check if user has table permission
      const tablePermission = await this.getTablePermissionLevel(userId, tableId);
      return tablePermission !== null;
    } catch (error) {
      console.error("[PermissionService] Error checking table access:", error);
      return false;
    }
  }

  /**
   * Check if user is workspace member
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns Promise<boolean>
   */
  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, workspaceId);
    return role !== null;
  }

  /**
   * Check if user is workspace owner
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns Promise<boolean>
   */
  async isOwner(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const workspace = await Workspace.findById(workspaceId).select("owner");
      if (!workspace) {
        return false;
      }
      return workspace.owner.toString() === userId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user is admin or owner
   * @param userId - User ID
   * @param workspaceId - Workspace ID
   * @returns Promise<boolean>
   */
  async isAdminOrOwner(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, workspaceId);
    return role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER;
  }

  /**
   * Check task-specific permissions
   * Members can edit/change status of tasks they're assigned to OR if they have proper permissions
   */
  async checkTaskPermission(
    userId: string,
    action: PermissionAction,
    context: PermissionContext,
    role: WorkspaceRole
  ): Promise<boolean> {
    // Admins and owners can do anything
    if (role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER) {
      return true;
    }

    // For EDIT_TASK and CHANGE_STATUS, check if user has list/folder/space permissions OR is assignee
    if (action === "EDIT_TASK" || action === "CHANGE_STATUS") {
      if (!context.resourceId) {
        return false;
      }

      const task = await Task.findById(context.resourceId).select("assignee");
      
      if (!task) {
        return false;
      }

      // Allow if user is the assignee
      if (task.assignee && task.assignee.toString() === userId) {
        return true;
      }

      // If user has list/folder/space override permissions, they already passed the permission check
      // So if we got here with list/folder/space context, they have permission
      if (context.listId || context.folderId || context.spaceId) {
        return true;
      }

      return false;
    }

    return true;
  }

  /**
   * Check if action is task-related
   */
  isTaskAction(action: PermissionAction): boolean {
    const taskActions: PermissionAction[] = [
      "CREATE_TASK",
      "DELETE_TASK",
      "EDIT_TASK",
      "VIEW_TASK",
      "ASSIGN_TASK",
      "CHANGE_STATUS",
      "COMMENT_TASK",
    ];
    return taskActions.includes(action);
  }

  /**
   * Check if action is space-related (requires space membership for members)
   */
  isSpaceAction(action: PermissionAction): boolean {
    const spaceActions: PermissionAction[] = [
      "CREATE_FOLDER",
      "DELETE_FOLDER",
      "UPDATE_FOLDER",
      "CREATE_LIST",
      "DELETE_LIST",
      "UPDATE_LIST",
      "CREATE_TASK",
      "DELETE_TASK",
      "EDIT_TASK",
      "ASSIGN_TASK",
      "CHANGE_STATUS",
    ];
    return spaceActions.includes(action);
  }

  /**
   * Check if user is a member of a space
   * @param userId - User ID
   * @param spaceId - Space ID
   * @returns Promise<boolean>
   */
  async isSpaceMember(userId: string, spaceId: string): Promise<boolean> {
    try {
      const Space = require("../models/Space");
      const space = await Space.findById(spaceId).select("members");
      
      if (!space) {
        return false;
      }

      return space.members.some((member: any) => {
        const memberId = typeof member.user === 'string' ? member.user : member.user?.toString();
        return memberId === userId;
      });
    } catch (error) {
      console.error("[PermissionService] Error checking space membership:", error);
      return false;
    }
  }

  /**
   * Normalize role string to WorkspaceRole enum
   */
  normalizeRole(role: string): WorkspaceRole {
    console.log('  🔄 Normalizing role...');
    console.log('    ➜ Input:', role, '(type:', typeof role, ')');
    
    const roleLower = role.toLowerCase();
    console.log('    ➜ Lowercased:', roleLower);
    
    let result: WorkspaceRole;
    
    if (roleLower === "owner") {
      result = WorkspaceRole.OWNER;
      console.log('    ➜ Matched: OWNER');
    } else if (roleLower === "admin") {
      result = WorkspaceRole.ADMIN;
      console.log('    ➜ Matched: ADMIN');
    } else if (roleLower === "member") {
      result = WorkspaceRole.MEMBER;
      console.log('    ➜ Matched: MEMBER');
    } else if (roleLower === "guest") {
      result = WorkspaceRole.GUEST;
      console.log('    ➜ Matched: GUEST');
    } else {
      result = WorkspaceRole.GUEST;
      console.log('    ➜ No match, defaulting to GUEST');
    }
    
    console.log('    ➜ Output:', result, '(type:', typeof result, ')');
    console.log('    ➜ WorkspaceRole.ADMIN constant:', WorkspaceRole.ADMIN);
    console.log('    ➜ Are they equal?:', result === WorkspaceRole.ADMIN);
    
    return result;
  }
}

module.exports = new PermissionService();

export {};
