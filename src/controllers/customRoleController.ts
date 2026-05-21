const CustomRole = require("../models/CustomRole");
const Workspace = require("../models/Workspace");
const EntitlementService = require("../services/entitlementService").default;
const { ROLE_PERMISSIONS } = require("../permissions/permission.constants");

const PERMISSION_CATALOG = [
  { key: "VIEW_WORKSPACE", label: "Workspace Home Access", category: "Workspace Access" },
  { key: "UPDATE_WORKSPACE", label: "Edit Workspace Profile", category: "Workspace Access" },
  { key: "LEAVE_WORKSPACE", label: "Leave Workspace", category: "Workspace Access" },
  { key: "INVITE_MEMBER", label: "Invite Members", category: "Member Admin" },
  { key: "REMOVE_MEMBER", label: "Remove Members", category: "Member Admin" },
  { key: "CHANGE_MEMBER_ROLE", label: "Change Member Roles", category: "Member Admin" },
  { key: "MANAGE_CUSTOM_ROLES", label: "Manage Role Templates", category: "Member Admin" },
  { key: "CREATE_SPACE", label: "Create Spaces", category: "Hierarchy" },
  { key: "DELETE_SPACE", label: "Delete Spaces", category: "Hierarchy" },
  { key: "UPDATE_SPACE", label: "Edit Spaces", category: "Hierarchy" },
  { key: "VIEW_SPACE", label: "View Spaces", category: "Hierarchy" },
  { key: "ADD_SPACE_MEMBER", label: "Add Space Members", category: "Hierarchy" },
  { key: "REMOVE_SPACE_MEMBER", label: "Remove Space Members", category: "Hierarchy" },
  { key: "MANAGE_SPACE_PERMISSIONS", label: "Manage Space Permissions", category: "Hierarchy" },
  { key: "CREATE_FOLDER", label: "Create Folders", category: "Hierarchy" },
  { key: "DELETE_FOLDER", label: "Delete Folders", category: "Hierarchy" },
  { key: "UPDATE_FOLDER", label: "Edit Folders", category: "Hierarchy" },
  { key: "VIEW_FOLDER", label: "View Folders", category: "Hierarchy" },
  { key: "CREATE_LIST", label: "Create Lists", category: "Hierarchy" },
  { key: "DELETE_LIST", label: "Delete Lists", category: "Hierarchy" },
  { key: "UPDATE_LIST", label: "Edit Lists", category: "Hierarchy" },
  { key: "VIEW_LIST", label: "View Lists", category: "Hierarchy" },
  { key: "CREATE_TASK", label: "Create Tasks", category: "Task Execution" },
  { key: "DELETE_TASK", label: "Delete Tasks", category: "Task Execution" },
  { key: "EDIT_TASK", label: "Edit Tasks", category: "Task Execution" },
  { key: "VIEW_TASK", label: "View Tasks", category: "Task Execution" },
  { key: "ASSIGN_TASK", label: "Assign Tasks", category: "Task Execution" },
  { key: "CHANGE_STATUS", label: "Change Task Status", category: "Task Execution" },
  { key: "MARK_TASK_DONE", label: "Approve Done Status", category: "Task Execution" },
  { key: "COMMENT_TASK", label: "Comment on Tasks", category: "Task Collaboration" },
  { key: "VIEW_ANNOUNCEMENT", label: "View Announcements", category: "Announcements" },
  { key: "CREATE_ANNOUNCEMENT", label: "Create Announcements", category: "Announcements" },
  { key: "DELETE_ANNOUNCEMENT", label: "Delete Announcements", category: "Announcements" },
  { key: "VIEW_ANALYTICS_PERSONAL", label: "View Personal Analytics", category: "Analytics" },
  { key: "VIEW_ANALYTICS_TEAM", label: "View Workspace Analytics", category: "Analytics" },
  { key: "VIEW_ACTIVITY_LOG", label: "View Activity Log", category: "Analytics" },
  { key: "MANAGE_SETTINGS", label: "Manage Workspace Settings", category: "Workspace Settings" },
];

const ALLOWED_PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((item) => item.key));
const SYSTEM_ROLES = ["owner", "admin", "operations_manager", "project_manager", "qa", "developer", "member", "guest"];
const ALL_PERMISSION_KEYS = new Set<string>([
  ...Object.values(ROLE_PERMISSIONS).flatMap((arr: string[]) => arr),
  ...PERMISSION_CATALOG.map((item) => item.key),
]);

const normalizePermissions = (permissions: unknown): string[] => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const normalized = new Set<string>();

  for (const permission of permissions) {
    if (typeof permission !== "string") continue;
    const key = permission.trim();
    if (!key) continue;

    // Backward compatibility for existing clients/roles
    if (key === "VIEW_ANALYTICS") {
      normalized.add("VIEW_ANALYTICS_PERSONAL");
      normalized.add("VIEW_ANALYTICS_TEAM");
      continue;
    }

    if (ALLOWED_PERMISSION_KEYS.has(key)) {
      normalized.add(key);
    }
  }

  // Team analytics always includes personal visibility.
  if (normalized.has("VIEW_ANALYTICS_TEAM")) {
    normalized.add("VIEW_ANALYTICS_PERSONAL");
  }

  return [...normalized];
};

/**
 * Get available permission catalog for custom roles
 */
export const getPermissionCatalog = async (_req: any, res: any) => {
  res.status(200).json({
    success: true,
    data: PERMISSION_CATALOG
  });
};

/**
 * Get all custom roles in a workspace
 */
export const getCustomRoles = async (req: any, res: any) => {
  try {
    const { workspaceId } = req.params;
    const roles = await CustomRole.find({ workspace: workspaceId });
    
    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new custom role
 */
export const createCustomRole = async (req: any, res: any) => {
  try {
    const { workspaceId } = req.params;
    const { name, label, color, permissions, description } = req.body;
    const normalizedPermissions = normalizePermissions(permissions);
    const workspace = await Workspace.findById(workspaceId).select("owner");
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    const canUseCustomRoles = await EntitlementService.canUseCustomRolesInWorkspace(workspaceId);
    if (!canUseCustomRoles.allowed) {
      return res.status(403).json({ success: false, message: canUseCustomRoles.reason });
    }

    const plan = await EntitlementService.getUserPlan(workspace.owner.toString());
    const PlanInheritanceService = require("../services/planInheritanceService").default;
    const features = await PlanInheritanceService.resolveFeatures(plan);
    const maxCustomRoles = features?.maxCustomRoles ?? -1;

    if (maxCustomRoles !== -1) {
      const currentCount = await CustomRole.countDocuments({ workspace: workspaceId });
      if (currentCount >= maxCustomRoles) {
        return res.status(403).json({
          success: false,
          code: "CUSTOM_ROLE_LIMIT_REACHED",
          message: `Custom role limit reached (${currentCount}/${maxCustomRoles}).`,
        });
      }
    }

    const role = await CustomRole.create({
      name,
      label,
      color,
      permissions: normalizedPermissions,
      description,
      workspace: workspaceId
    });

    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Update a custom role
 */
export const updateCustomRole = async (req: any, res: any) => {
  try {
    const { roleId } = req.params;
    const { name, label, color, permissions, description } = req.body;
    const updateData: any = { name, label, color, description };
    if (permissions !== undefined) {
      updateData.permissions = normalizePermissions(permissions);
    }

    const role = await CustomRole.findByIdAndUpdate(
      roleId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete a custom role
 */
export const deleteCustomRole = async (req: any, res: any) => {
  try {
    const { roleId } = req.params;

    const role = await CustomRole.findByIdAndDelete(roleId);

    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Clean up: Remove this role from any members who have it
    await Workspace.updateMany(
      { "members.customRole": roleId },
      { $set: { "members.$.customRole": null } }
    );

    res.status(200).json({
      success: true,
      message: "Role deleted successfully and members updated"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Assign a custom role to a member
 */
export const assignRoleToMember = async (req: any, res: any) => {
  try {
    const { workspaceId, memberId, userId } = req.params;
    const targetMemberId = memberId || userId;
    const { customRoleId } = req.body;

    const canUseCustomRoles = await EntitlementService.canUseCustomRolesInWorkspace(workspaceId);
    if (!canUseCustomRoles.allowed) {
      return res.status(403).json({ success: false, message: canUseCustomRoles.reason });
    }

    // Verify role belongs to workspace if provided
    if (customRoleId) {
      const role = await CustomRole.findOne({ _id: customRoleId, workspace: workspaceId });
      if (!role) {
        return res.status(400).json({ success: false, message: "Invalid role for this workspace" });
      }
    }

    const workspace = await Workspace.findOneAndUpdate(
      { _id: workspaceId, "members.user": targetMemberId },
      { $set: { "members.$.customRole": customRoleId || null } },
      { new: true }
    );

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Member not found in workspace" });
    }

    res.status(200).json({
      success: true,
      message: "Role assigned successfully"
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get workspace-specific additive permission boosts for built-in system roles
 */
export const getSystemRolePermissionAdditions = async (req: any, res: any) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId).select("rolePermissionAdditions");
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    res.status(200).json({
      success: true,
      data: workspace.rolePermissionAdditions || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upsert additive permission boosts for a built-in system role in a single workspace.
 * This is ADDITIVE only: base role permissions remain intact.
 */
export const upsertSystemRolePermissionAdditions = async (req: any, res: any) => {
  try {
    const { workspaceId } = req.params;
    const { role, permissions } = req.body || {};

    const normalizedRole = String(role || "").trim().toLowerCase();
    if (!SYSTEM_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: "Invalid system role" });
    }

    const requested = Array.isArray(permissions) ? permissions : [];
    const normalizedPermissions = [...new Set(
      requested
        .filter((p: unknown) => typeof p === "string")
        .map((p: string) => p.trim())
        .filter((p: string) => p && ALL_PERMISSION_KEYS.has(p))
    )];

    const basePermissions = new Set<string>(ROLE_PERMISSIONS[normalizedRole] || []);
    const additiveOnly = normalizedPermissions.filter((p: string) => !basePermissions.has(p));

    const workspace = await Workspace.findById(workspaceId).select("rolePermissionAdditions");
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    const entries = Array.isArray(workspace.rolePermissionAdditions) ? workspace.rolePermissionAdditions : [];
    const idx = entries.findIndex((r: any) => String(r.role || "").toLowerCase() === normalizedRole);

    if (additiveOnly.length === 0) {
      if (idx !== -1) entries.splice(idx, 1);
    } else if (idx === -1) {
      entries.push({ role: normalizedRole, permissions: additiveOnly });
    } else {
      entries[idx].permissions = additiveOnly;
    }

    workspace.rolePermissionAdditions = entries;
    await workspace.save();

    res.status(200).json({
      success: true,
      message: "System role additive permissions updated",
      data: workspace.rolePermissionAdditions || []
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMemberAdditionalPermissions = async (req: any, res: any) => {
  try {
    const { workspaceId, memberId } = req.params;
    const workspace = await Workspace.findById(workspaceId).select("members.user members.additionalPermissions members.restrictedPermissions");
    if (!workspace) {
      return res.status(404).json({ success: false, message: "Workspace not found" });
    }

    const member = workspace.members.find((m: any) => m.user.toString() === memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found in workspace" });
    }

    res.status(200).json({
      success: true,
      data: {
        additionalPermissions: member.additionalPermissions || [],
        restrictedPermissions: member.restrictedPermissions || []
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertMemberAdditionalPermissions = async (req: any, res: any) => {
  try {
    const { workspaceId, memberId } = req.params;
    const { permissions, additionalPermissions, restrictedPermissions } = req.body || {};
    const requestedAdditional = Array.isArray(additionalPermissions)
      ? additionalPermissions
      : Array.isArray(permissions)
        ? permissions
        : [];
    const requestedRestricted = Array.isArray(restrictedPermissions) ? restrictedPermissions : [];
    const normalizedAdditionalPermissions = [...new Set(
      requestedAdditional
        .filter((p: unknown) => typeof p === "string")
        .map((p: string) => p.trim())
        .filter((p: string) => p && ALL_PERMISSION_KEYS.has(p))
    )];
    const normalizedRestrictedPermissions = [...new Set(
      requestedRestricted
        .filter((p: unknown) => typeof p === "string")
        .map((p: string) => p.trim())
        .filter((p: string) => p && ALL_PERMISSION_KEYS.has(p))
    )];

    const workspace = await Workspace.findOneAndUpdate(
      { _id: workspaceId, "members.user": memberId },
      {
        $set: {
          "members.$.additionalPermissions": normalizedAdditionalPermissions,
          "members.$.restrictedPermissions": normalizedRestrictedPermissions
        }
      },
      { new: true }
    ).select("members.user members.additionalPermissions members.restrictedPermissions");

    if (!workspace) {
      return res.status(404).json({ success: false, message: "Member not found in workspace" });
    }

    const member = workspace.members.find((m: any) => m.user.toString() === memberId);
    res.status(200).json({
      success: true,
      message: "Member permission overrides updated",
      data: {
        additionalPermissions: member?.additionalPermissions || [],
        restrictedPermissions: member?.restrictedPermissions || []
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
