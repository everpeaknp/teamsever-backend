const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const controller = require("../controllers/attendanceLocationController");

router.use(protect);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy:
 *   get:
 *     summary: Get the caller's effective attendance-location policy
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Policy, eligible areas, and own running shift }
 *       403: { description: Active workspace membership required }
 *   put:
 *     summary: Update attendance areas and enforcement
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires the workspace-scoped MANAGE_ATTENDANCE_LOCATIONS permission. Enabling requires an active office and valid assignments for all remote members.
 *     responses:
 *       200: { description: Updated policy }
 *       403: { description: Missing workspace permission }
 */
router.get("/workspace/:workspaceId/location-policy", controller.getLocationPolicy);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy/members:
 *   get:
 *     summary: List workspace attendance work modes and remote assignments
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ATTENDANCE_LOCATIONS in this workspace. Returns assignment metadata without location coordinates.
 *     responses:
 *       200: { description: Workspace attendance assignments }
 *       403: { description: Missing workspace permission }
 */
router.get("/workspace/:workspaceId/location-policy/members", requirePermission("MANAGE_ATTENDANCE_LOCATIONS"), controller.getLocationAssignments);
router.put("/workspace/:workspaceId/location-policy", requirePermission("MANAGE_ATTENDANCE_LOCATIONS"), controller.updateLocationPolicy);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy/members/{memberId}:
 *   patch:
 *     summary: Assign a member's work mode and remote areas
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ATTENDANCE_LOCATIONS in this workspace. Area IDs must identify active remote areas in the same workspace.
 *     responses:
 *       200: { description: Assignment updated }
 *       403: { description: Missing workspace permission }
 */
router.patch("/workspace/:workspaceId/location-policy/members/:memberId", requirePermission("MANAGE_ATTENDANCE_LOCATIONS"), controller.assignMemberAttendanceLocations);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-checks:
 *   post:
 *     summary: Record an active-shift location check
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Members may report only their own running time entry. Raw coordinates are used only for validation and are never persisted.
 *     responses:
 *       201: { description: Location check recorded }
 *       404: { description: Own running entry not found in this workspace }
 *   get:
 *     summary: Read own location checks or team review flags
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Team events require MANAGE_ATTENDANCE_LOCATIONS in the requested workspace.
 *     responses:
 *       200: { description: Location events without coordinates }
 *       403: { description: Not authorized to read team events }
 */
router.post("/workspace/:workspaceId/location-checks", controller.postLocationCheck);
router.get("/workspace/:workspaceId/location-checks", controller.getLocationChecks);

module.exports = router;
export {};
