const express = require("express");
const router = express.Router({ mergeParams: true });
const customRoleController = require("../controllers/customRoleController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

router.use(protect);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/custom-roles:
 *   get:
 *     summary: Get workspace custom roles
 *     description: Returns all custom roles defined in the workspace.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom roles returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/CustomRole"
 *   post:
 *     summary: Create custom role
 *     description: Creates a new custom role with selected permissions.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CustomRoleUpsertInput"
 *     responses:
 *       201:
 *         description: Custom role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: "#/components/schemas/CustomRole"
 */
router.route("/:workspaceId/custom-roles")
  .get(requirePermission("VIEW_WORKSPACE"), customRoleController.getCustomRoles)
  .post(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.createCustomRole);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/custom-roles/permission-catalog:
 *   get:
 *     summary: Get custom-role permission catalog
 *     description: Returns the canonical permission keys/labels/categories for role-builder UIs.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission catalog returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string, example: "MARK_TASK_DONE" }
 *                       label: { type: string, example: "Approve Task Done" }
 *                       category: { type: string, example: "Task" }
 */
router.get(
  "/:workspaceId/custom-roles/permission-catalog",
  requirePermission("VIEW_WORKSPACE"),
  customRoleController.getPermissionCatalog
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/custom-roles/{roleId}:
 *   patch:
 *     summary: Update custom role
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CustomRoleUpsertInput"
 *     responses:
 *       200:
 *         description: Custom role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: "#/components/schemas/CustomRole"
 *   delete:
 *     summary: Delete custom role
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
router.route("/:workspaceId/custom-roles/:roleId")
  .patch(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.updateCustomRole)
  .delete(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.deleteCustomRole);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{memberId}/custom-role:
 *   patch:
 *     summary: Assign custom role to workspace member
 *     description: Assign or clear a workspace-scoped custom role for one member.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customRoleId:
 *                 type: string
 *                 nullable: true
 *                 description: Send null to clear the assigned custom role.
 *     responses:
 *       200:
 *         description: Member custom role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 */
router.patch(
  "/:workspaceId/members/:memberId/custom-role",
  requirePermission("MANAGE_CUSTOM_ROLES"),
  customRoleController.assignRoleToMember
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/system-roles/permission-additions:
 *   get:
 *     summary: Get workspace-specific system role additions
 *     description: Returns additive permission entries for built-in system roles in this workspace only.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Additive system-role permissions returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SystemRolePermissionAdditionsResponse"
 *   patch:
 *     summary: Upsert workspace-specific system role additions
 *     description: |
 *       Additive-only permission tuning for a built-in system role inside one workspace.
 *       Base role permissions remain intact and should not be included in the payload.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, permissions]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, admin, operations_manager, project_manager, qa, developer, member, guest]
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *                 description: Additive-only permission keys to append for this workspace.
 *     responses:
 *       200:
 *         description: System role additive permissions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SystemRolePermissionAdditionsResponse"
 */
router.route("/:workspaceId/system-roles/permission-additions")
  .get(requirePermission("VIEW_WORKSPACE"), customRoleController.getSystemRolePermissionAdditions)
  .patch(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.upsertSystemRolePermissionAdditions);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/members/{memberId}/permission-additions:
 *   get:
 *     summary: Get member permission overrides
 *     description: Returns additive and restrictive permission overrides for one workspace member.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member permission overrides returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/MemberPermissionOverridesResponse"
 *   patch:
 *     summary: Upsert member permission overrides
 *     description: |
 *       Sets member-specific additive and restrictive permission overrides for this workspace.
 *       `permissions` remains accepted as a backward-compatible alias for `additionalPermissions`.
 *     tags: ["2.4 Workspaces — Custom Roles"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               additionalPermissions:
 *                 type: array
 *                 items: { type: string }
 *               restrictedPermissions:
 *                 type: array
 *                 items: { type: string }
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *                 description: Backward-compatible alias of `additionalPermissions`.
 *     responses:
 *       200:
 *         description: Member permission overrides updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/MemberPermissionOverridesResponse"
 */
router.route("/:workspaceId/members/:memberId/permission-additions")
  .get(requirePermission("VIEW_WORKSPACE"), customRoleController.getMemberAdditionalPermissions)
  .patch(requirePermission("MANAGE_CUSTOM_ROLES"), customRoleController.upsertMemberAdditionalPermissions);

module.exports = router;
