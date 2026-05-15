const express = require("express");
const router = express.Router({ mergeParams: true });
const customRoleController = require("../controllers/customRoleController");
const { protect } = require("./authRoutes"); // Assuming protect is exported from authRoutes
const { requirePermission } = require("../permissions/permission.middleware");

// All routes are protected and require a workspace context
router.use(protect);

// Workspace-scoped custom role management
router.route("/:workspaceId/custom-roles")
  .get(requirePermission("VIEW_WORKSPACE"), customRoleController.getCustomRoles)
  .post(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.createCustomRole);

router.route("/:workspaceId/custom-roles/:roleId")
  .patch(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.updateCustomRole)
  .delete(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.deleteCustomRole);

// Member assignment
router.patch(
  "/:workspaceId/members/:userId/custom-role",
  requirePermission("MANAGE_CUSTOM_ROLES"),
  customRoleController.assignRoleToMember
);

module.exports = router;
