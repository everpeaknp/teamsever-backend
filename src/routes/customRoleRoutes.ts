const express = require("express");
const router = express.Router({ mergeParams: true });
const customRoleController = require("../controllers/customRoleController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

router.use(protect);

router.route("/:workspaceId/custom-roles")
  .get(requirePermission("VIEW_WORKSPACE"), customRoleController.getCustomRoles)
  .post(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.createCustomRole);

router.route("/:workspaceId/custom-roles/:roleId")
  .patch(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.updateCustomRole)
  .delete(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.deleteCustomRole);

router.patch(
  "/:workspaceId/members/:memberId/custom-role",
  requirePermission("MANAGE_CUSTOM_ROLES"),
  customRoleController.assignRoleToMember
);

module.exports = router;
