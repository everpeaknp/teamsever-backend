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
 *     summary: Update the one shared office geofence and enforcement
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ADDRESSES (legacy MANAGE_ATTENDANCE_LOCATIONS is accepted). The shared office is fixed to a 60 m radius; member remote places are managed separately and privately.
 *     responses:
 *       200: { description: Updated policy }
 *       403: { description: Missing workspace permission }
 */
router.get("/workspace/:workspaceId/location-policy", controller.getLocationPolicy);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy/members:
 *   get:
 *     summary: List member attendance modes and private remote place metadata
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ADDRESSES in this workspace. Returns private remote-place coordinates only to authorized address managers.
 *     responses:
 *       200: { description: Workspace attendance assignments }
 *       403: { description: Missing workspace permission }
 */
router.get("/workspace/:workspaceId/location-policy/members", controller.getLocationAssignments);
router.put("/workspace/:workspaceId/location-policy", controller.updateLocationPolicy);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy/members/{memberId}:
 *   patch:
 *     summary: Assign a member's work mode and remote areas
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ADDRESSES. Remote places are private to the selected member and cannot be assigned to another member.
 *     responses:
 *       200: { description: Assignment updated }
 *       403: { description: Missing workspace permission }
 */
router.patch("/workspace/:workspaceId/location-policy/members/:memberId", controller.assignMemberAttendanceLocations);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-policy/members/{memberId}/remote-areas:
 *   put:
 *     summary: Replace one member's private remote places
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Requires MANAGE_ADDRESSES in the same workspace. Coordinates are private to the member and authorized address managers.
 *     responses:
 *       200: { description: Updated private remote places }
 *       403: { description: Missing address permission }
 */
router.put("/workspace/:workspaceId/location-policy/members/:memberId/remote-areas", controller.updateMemberRemoteAreas);
/**
 * @swagger
 * /api/attendance/workspace/{workspaceId}/location-checks:
 *   post:
 *     summary: Record an active-shift location check
 *     tags: [Leaves & Attendance]
 *     security: [{ bearerAuth: [] }]
 *     description: Members may report only their own running time entry. Periodic checks do not store raw coordinates; clock-in and clock-out endpoint coordinates are retained privately on the time entry for authorized attendance reports.
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
