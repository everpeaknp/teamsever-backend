const CustomRole = require("../models/CustomRole");
const Workspace = require("../models/Workspace");

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

    const role = await CustomRole.create({
      name,
      label,
      color,
      permissions,
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

    const role = await CustomRole.findByIdAndUpdate(
      roleId,
      { name, label, color, permissions, description },
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
