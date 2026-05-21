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
const List = require("../models/List");
const Task = require("../models/Task");

class PermissionService {
  private getRolePermissionAdditions(workspace: any, role: WorkspaceRole): PermissionAction[] {
    const additions = workspace?.rolePermissionAdditions || [];
    const roleRow = additions.find((r: any) => String(r.role || "").toLowerCase() === String(role).toLowerCase());
    if (!roleRow || !Array.isArray(roleRow.permissions)) return [];
    return roleRow.permissions as PermissionAction[];
  }

  private getMemberAdditionalPermissions(workspace: any, userId: string): PermissionAction[] {
    const member = workspace?.members?.find((m: any) => m.user?.toString?.() === userId);
    if (!member || !Array.isArray(member.additionalPermissions)) return [];
    return member.additionalPermissions as PermissionAction[];
  }

  private getMemberRestrictedPermissions(workspace: any, userId: string): PermissionAction[] {
    const member = workspace?.members?.find((m: any) => m.user?.toString?.() === userId);
    if (!member || !Array.isArray(member.restrictedPermissions)) return [];
    return member.restrictedPermissions as PermissionAction[];
  }

  private customRoleIncludesAction(customRolePermissions: string[], action: PermissionAction): boolean {
    if (customRolePermissions.includes(action)) {
      return true;
    }

    // Backward compatibility: old roles stored a single VIEW_ANALYTICS permission.
    if (
      (action === "VIEW_ANALYTICS_PERSONAL" || action === "VIEW_ANALYTICS_TEAM") &&
      customRolePermissions.includes("VIEW_ANALYTICS")
    ) {
      return true;
    }

    // Team analytics permission always implies personal analytics access.
    if (action === "VIEW_ANALYTICS_PERSONAL" && customRolePermissions.includes("VIEW_ANALYTICS_TEAM")) {
      return true;
    }

    return false;
  }

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

      // Step 2.5: Check for Custom Role permissions
      const CustomRole = require("../models/CustomRole");
      const workspace = await Workspace.findById(context.workspaceId).select("members rolePermissionAdditions");
      const member = workspace?.members?.find((m: any) => m.user.toString() === userId);
      const rolePermissionAdditions = this.getRolePermissionAdditions(workspace, workspaceRole);
      const memberAdditionalPermissions = this.getMemberAdditionalPermissions(workspace, userId);
      const memberRestrictedPermissions = this.getMemberRestrictedPermissions(workspace, userId);

      // Member-level restrictions are the strongest non-owner override.
      // They explicitly remove inherited role/custom/additive access for this workspace.
      if (memberRestrictedPermissions.includes(action)) {
        return false;
      }
      
      if (member?.customRole) {
        const customRoleDoc = await CustomRole.findById(member.customRole);
        if (customRoleDoc && this.customRoleIncludesAction(customRoleDoc.permissions || [], action)) {
          return true;
        }
      }

      // Step 3: Check for list-level override
      // NOTE: We treat overrides as grants, not hard denials.
      // If list override does not allow an action, we still fall through to
      // folder/space/workspace checks (so space FULL can still grant access).
      if (context.listId) {
        const listPermission = await this.getListPermissionLevel(
          userId,
          context.listId
        );

        if (listPermission) {
          const hasListPermission = listPermissionHasAction(listPermission, action);
          if (hasListPermission) {
            return true;
          }
        }
      }

      // Step 4: Check for folder-level override
      // Same behavior: grant if allowed, otherwise continue.
      if (context.folderId) {
        const folderPermission = await this.getFolderPermissionLevel(
          userId,
          context.folderId
        );

        if (folderPermission) {
          const hasFolderPermission = folderPermissionHasAction(folderPermission, action);
          if (hasFolderPermission) {
            return true;
          }
        }
      }

      // Step 5: Check for space-level override
      if (context.spaceId) {
        const spacePermission = await this.getSpacePermissionLevel(
          userId,
          context.spaceId
        );

        if (spacePermission) {
          const hasSpacePermission = spacePermissionHasAction(spacePermission, action);
          if (hasSpacePermission) {
            return true;
          }
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
          
          // Check if user is an assignee of any task in this space/resource
          let isAssigneeSomewhere = false;
          if (!isSpaceMember) {
             const assignedTasksCount = await Task.countDocuments({
               workspace: context.workspaceId,
               space: context.spaceId,
               assignee: userId,
               isDeleted: false
             });
             isAssigneeSomewhere = assignedTasksCount > 0;
          }

          if (!isSpaceMember && !isAssigneeSomewhere) {
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
      const hasWorkspacePermission =
        roleHasPermission(workspaceRole, action) ||
        rolePermissionAdditions.includes(action) ||
        memberAdditionalPermissions.includes(action);
      console.log('  ➜ Has workspace permission?', hasWorkspacePermission);
      
      if (!hasWorkspacePermission) {
        // Step 7: Apply task-specific rules (assignee check as fallback)
        if (this.isTaskAction(action) && context.resourceType === "task") {
          console.log('\n🔎 Step 7: Checking task-specific permissions...');
          const result = await this.checkTaskPermission(
            userId,
            action,
            context,
            workspaceRole,
            [...rolePermissionAdditions, ...memberAdditionalPermissions]
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

      if (spaceMember?.permissionLevel) {
        return spaceMember.permissionLevel;
      }

      // Backward-compatibility fallback:
      // some older flows only persisted permissionLevel in Space.members.
      const Space = require("../models/Space");
      const space = await Space.findById(spaceId).select("members.user members.permissionLevel");
      const nestedMember = space?.members?.find((m: any) => m.user?.toString?.() === userId);

      if (nestedMember?.permissionLevel) {
        return nestedMember.permissionLevel;
      }

      return null;
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

      if (listMember?.permissionLevel) {
        return listMember.permissionLevel;
      }

      // Backward-compatibility fallback for legacy nested list member permissions
      const list = await List.findById(listId).select("members.user members.permissionLevel");
      const nestedMember = list?.members?.find((m: any) => m.user?.toString?.() === userId);
      if (nestedMember?.permissionLevel) {
        return nestedMember.permissionLevel;
      }

      return null;
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
    role: WorkspaceRole,
    rolePermissionAdditions: PermissionAction[] = []
  ): Promise<boolean> {
    // Admins and owners can do anything
    if (role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER || role === WorkspaceRole.OPERATIONS_MANAGER) {
      return true;
    }

    // Task-specific actions
    if (!context.resourceId && context.resourceType === "task") {
      // This is a create action or bulk action without specific ID
      return roleHasPermission(role, action) || rolePermissionAdditions.includes(action);
    }

    if (context.resourceType === "task" && context.resourceId) {
      const task = await Task.findById(context.resourceId).select("assignee");
      if (!task) return false;

      const isAssignee = task.assignee && task.assignee.toString() === userId;

      // Assignees can VIEW, COMMENT, CHANGE STATUS, and EDIT their own tasks
      if (isAssignee) {
        const allowedAssigneeActions: PermissionAction[] = [
          "VIEW_TASK",
          "COMMENT_TASK",
          "CHANGE_STATUS",
          "EDIT_TASK"
        ];
        if (allowedAssigneeActions.includes(action)) {
          return true;
        }
      }
    }

    // Default to workspace role permissions
    return roleHasPermission(role, action) || rolePermissionAdditions.includes(action);
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
      "MARK_TASK_DONE",
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
      "MARK_TASK_DONE",
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
    } else if (roleLower === "operations_manager") {
      result = WorkspaceRole.OPERATIONS_MANAGER;
      console.log('    ➜ Matched: OPERATIONS_MANAGER');
    } else if (roleLower === "project_manager") {
      result = WorkspaceRole.PROJECT_MANAGER;
      console.log('    ➜ Matched: PROJECT_MANAGER');
    } else if (roleLower === "qa") {
      result = WorkspaceRole.QA;
      console.log('    ➜ Matched: QA');
    } else if (roleLower === "developer") {
      result = WorkspaceRole.DEVELOPER;
      console.log('    ➜ Matched: DEVELOPER');
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
