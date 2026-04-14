const express = require("express");
const router = express.Router();
const presenceController = require("../controllers/presenceController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * /api/presence/{workspaceId}:
 *   get:
 *     summary: Get workspace presence
 *     description: Returns the online/offline status and last seen timestamp for all members of a specific workspace.
 *     tags: ["5.4 Collaboration — Presence"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Presence data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data: { $ref: "#/components/schemas/WorkspacePresence" }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get(
  "/:workspaceId",
  protect,
  presenceController.getWorkspacePresence
);

/**
 * @swagger
 * /api/presence/{workspaceId}/online:
 *   get:
 *     summary: Get online users
 *     description: Returns a list of users who are currently connected via WebSockets in the specified workspace.
 *     tags: ["5.4 Collaboration — Presence"]
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
 *         description: Online users retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: ["69bce50b96fe109fe4e14ff6", "69bcc46789cab60dfa45500"]
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get(
  "/:workspaceId/online",
  protect,
  presenceController.getOnlineUsers
);

/**
 * @swagger
 * /api/presence/user/{userId}:
 *   get:
 *     summary: Get user presence
 *     description: Get the real-time presence status and last seen time for a specific user.
 *     tags: ["5.4 Collaboration — Presence"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User presence retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data: { $ref: "#/components/schemas/UserPresence" }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get(
  "/user/:userId",
  protect,
  presenceController.getUserPresence
);

module.exports = router;

export {};
