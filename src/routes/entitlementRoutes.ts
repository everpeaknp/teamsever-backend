const express = require("express");
const {
  checkEntitlement,
  getUsage
} = require("../controllers/entitlementController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/entitlements/check:
 *   get:
 *     summary: Check if user can perform a specific action
 *     description: Validates entitlement for actions like useCustomRoles, createTable, addRow
 *     tags: [Entitlements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [useCustomRoles, createTable, addRow]
 *         description: The action to check entitlement for
 *     responses:
 *       200:
 *         description: Entitlement check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 allowed:
 *                   type: boolean
 *                   example: true
 *                 reason:
 *                   type: string
 *                   example: "Table limit reached (5/5)"
 *                 currentUsage:
 *                   type: number
 *                   example: 5
 *                 limit:
 *                   type: number
 *                   example: 5
 *       400:
 *         description: Invalid action parameter
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/check", protect, checkEntitlement);

/**
 * @swagger
 * /api/entitlements/usage:
 *   get:
 *     summary: Get aggregated usage and limits
 *     description: Returns total usage across all owned workspaces and plan limits
 *     tags: [Entitlements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage and limits data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 usage:
 *                   type: object
 *                   properties:
 *                     totalWorkspaces:
 *                       type: number
 *                       example: 2
 *                     totalSpaces:
 *                       type: number
 *                       example: 5
 *                     totalLists:
 *                       type: number
 *                       example: 10
 *                     totalFolders:
 *                       type: number
 *                       example: 8
 *                     totalTasks:
 *                       type: number
 *                       example: 50
 *                     totalTables:
 *                       type: number
 *                       example: 3
 *                     totalRows:
 *                       type: number
 *                       example: 25
 *                 limits:
 *                   type: object
 *                   properties:
 *                     maxWorkspaces:
 *                       type: number
 *                       example: 5
 *                     maxSpaces:
 *                       type: number
 *                       example: 10
 *                     maxLists:
 *                       type: number
 *                       example: 20
 *                     maxFolders:
 *                       type: number
 *                       example: 15
 *                     maxTasks:
 *                       type: number
 *                       example: 100
 *                     maxTablesCount:
 *                       type: number
 *                       example: 5
 *                     maxRowsLimit:
 *                       type: number
 *                       example: 100
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/usage", protect, getUsage);

module.exports = router;

export {};
