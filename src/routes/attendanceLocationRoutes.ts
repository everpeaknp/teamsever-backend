const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const companionPairingRateLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many desktop pairing attempts. Wait a few minutes and retry." } });
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const controller = require("../controllers/attendanceLocationController");
const desktopController = require("../controllers/desktopAttendanceController");
const { desktopDeviceAuth } = require("../middlewares/desktopDeviceAuth");

// Device-scoped routes authenticate with the encrypted installation credential instead of a web JWT.
router.get("/desktop/status", desktopDeviceAuth, desktopController.getDeviceStatus);
router.get("/desktop/workspace/:workspaceId/presence-policy", desktopDeviceAuth, desktopController.getDesktopPresencePolicy);
router.post("/desktop/presence-session", desktopDeviceAuth, desktopController.attachPresenceToActiveShift);
router.post("/desktop/activity", desktopDeviceAuth, desktopController.recordAppPresence);
router.post("/desktop/companion/:timeEntryId/respond", desktopDeviceAuth, desktopController.respondToMobileShift);
router.post("/desktop/companion/pair", companionPairingRateLimit, desktopDeviceAuth, desktopController.pairMobileShiftWithCode);

router.use(protect);
router.get("/workspace/:workspaceId/desktop-presence-policy", desktopController.getDesktopPresencePolicy);
router.put("/workspace/:workspaceId/desktop-presence-policy", desktopController.updateDesktopPresencePolicy);
router.post("/desktop-devices", desktopController.createDevice);
router.get("/desktop-devices", desktopController.listDevices);
router.delete("/desktop-devices/:deviceId", desktopController.revokeDevice);
router.patch("/desktop-devices/:deviceId/activity-consent", desktopController.setActivityConsent);
router.patch("/desktop-devices/:deviceId/auto-sync-mobile-shifts", desktopController.setAutoSyncMobileShifts);
router.post("/workspace/:workspaceId/mobile-companion-code", companionPairingRateLimit, desktopController.createMobilePairingCode);
router.get("/workspace/:workspaceId/desktop-presence/current", desktopController.getWorkspaceCurrentPresence);
router.get("/workspace/:workspaceId/desktop-activity", desktopController.getAppPresence);
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
