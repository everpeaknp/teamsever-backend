const express = require("express");
const router = express.Router();
const presenceController = require("../controllers/presenceController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Presence
 *   description: User presence and online status
 */

/**
 * @swagger
 * /api/presence/{workspaceId}:
 *   get:
 *     summary: Get workspace presence
 *     description: Get online/offline status of all workspace members
 *     tags: [Presence]
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
 *         description: Presence data retrieved successfully
 *       401:
 *         description: Authentication required
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
 *     description: Get list of currently online users in workspace
 *     tags: [Presence]
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
 *       401:
 *         description: Authentication required
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
 *     description: Get specific user's presence status
 *     tags: [Presence]
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
 *       401:
 *         description: Authentication required
 */
router.get(
  "/user/:userId",
  protect,
  presenceController.getUserPresence
);

module.exports = router;

export {};
