import { Router } from "express";

const express = require("express");
const router = express.Router({ mergeParams: true });
const leaveController = require("../controllers/leaveController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

// All leave routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves:
 *   post:
 *     summary: Request leave
 *     description: Submit a leave request with compulsory reason. Validates 2-day monthly limit.
 *     tags: ["Leaves & Attendance"]
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
 *             required:
 *               - assignedManagerId
 *               - startDate
 *               - endDate
 *               - reason
 *             properties:
 *               assignedManagerId:
 *                 type: string
 *               conversationId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Leave request submitted
 */
router.post(
  "/",
  requirePermission("VIEW_WORKSPACE"),
  leaveController.requestLeave
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves/my-quota:
 *   get:
 *     summary: Check personal monthly leave quota
 *     tags: ["Leaves & Attendance"]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/my-quota",
  requirePermission("VIEW_WORKSPACE"),
  leaveController.getMyLeaveQuota
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves/today:
 *   get:
 *     summary: Get active leaves today
 *     tags: ["Leaves & Attendance"]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/today",
  requirePermission("VIEW_LEAVES"),
  leaveController.getActiveLeavesToday
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves:
 *   get:
 *     summary: Get workspace leaves
 *     tags: ["Leaves & Attendance"]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  requirePermission("VIEW_LEAVES"),
  leaveController.getWorkspaceLeaves
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves/{leaveId}/approve:
 *   patch:
 *     summary: Approve a leave request (Requires MANAGE_LEAVES)
 *     tags: ["Leaves & Attendance"]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:leaveId/approve",
  requirePermission("MANAGE_LEAVES"),
  leaveController.approveLeave
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/leaves/{leaveId}/deny:
 *   patch:
 *     summary: Deny a leave request (Requires MANAGE_LEAVES, optional denial reason)
 *     tags: ["Leaves & Attendance"]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:leaveId/deny",
  requirePermission("MANAGE_LEAVES"),
  leaveController.denyLeave
);

module.exports = router;
export default router;
