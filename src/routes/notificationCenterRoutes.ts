const express = require("express");
const router = express.Router();
const notificationCenterController = require("../controllers/notificationCenterController");
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * tags:
 *   name: Notification Center
 *   description: User notification center management
 */

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/notification-center/fcm-token:
 *   post:
 *     summary: Register FCM token
 *     description: Register Firebase Cloud Messaging token
 *     tags: [Notification Center]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: FCM token registered successfully
 *       401:
 *         description: Authentication required
 */
router.post("/fcm-token", notificationController.registerFCMToken);

/**
 * @swagger
 * /api/notification-center:
 *   get:
 *     summary: Get notifications
 *     description: Retrieve user's notifications
 *     tags: [Notification Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of notifications to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/", notificationCenterController.getNotifications);

/**
 * @swagger
 * /api/notification-center/unread-count:
 *   get:
 *     summary: Get unread count
 *     description: Get count of unread notifications
 *     tags: [Notification Center]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/unread-count", notificationCenterController.getUnreadCount);

/**
 * @swagger
 * /api/notification-center/read-all:
 *   patch:
 *     summary: Mark all as read
 *     description: Mark all notifications as read
 *     tags: [Notification Center]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Authentication required
 */
router.patch("/read-all", notificationCenterController.markAllAsRead);

/**
 * @swagger
 * /api/notification-center/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     tags: [Notification Center]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", notificationCenterController.markAsRead);

module.exports = router;

export {};
