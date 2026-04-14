const express = require("express");
const router = express.Router();
const notificationCenterController = require("../controllers/notificationCenterController");
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * @swagger
 * /api/notifications/fcm-token:
 *   post:
 *     summary: Register FCM device token
 *     description: Register a Firebase Cloud Messaging (FCM) token for push notifications. Call this when the app launches and gets a valid FCM token from Firebase.
 *     tags: ["10.2 Utilities — Notification Center"]
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
 *                 example: "dGhpcyBpcyBhIHNhbXBsZSBGQ00gdG9rZW4..."
 *     responses:
 *       200:
 *         description: FCM token registered
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "FCM token registered"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/fcm-token", notificationController.registerFCMToken);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get notifications
 *     description: Retrieve the current user's in-app notifications, newest first.
 *     tags: ["10.2 Utilities — Notification Center"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Notifications retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Notification" }
 *                 total: { type: "integer", example: 14 }
 *                 unread: { type: "integer", example: 3 }
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/", notificationCenterController.getNotifications);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create manual notification
 *     description: Manually trigger an in-app and push notification for a specific user. Used by background services or administrative actions (e.g. workspace invites, task assignments).
 *     tags: ["10.2 Utilities — Notification Center"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - type
 *               - title
 *               - message
 *             properties:
 *               recipientId:
 *                 type: string
 *                 example: "69bbf827a96fe78f716752aa"
 *               type:
 *                 type: string
 *                 enum: [INVITE, TASK_ASSIGNED, MENTION, SYSTEM]
 *                 example: "INVITE"
 *               title:
 *                 type: string
 *                 example: "New Workspace Invite"
 *               message:
 *                 type: string
 *                 example: "You have been invited to join 'Engineering Team'"
 *               link:
 *                 type: string
 *                 example: "/workspace/69bbf827a96fe78f716752bb"
 *               data:
 *                 type: object
 *                 description: Additional payload data for the notification
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: 1
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/", notificationCenterController.createNotification);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Returns the count of unread notifications. Use this to display the badge number on the notification bell icon.
 *     tags: ["10.2 Utilities — Notification Center"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 count: 5
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/unread-count", notificationCenterController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Marks all the current user's unread notifications as read. Useful when user opens the notification panel.
 *     tags: ["10.2 Utilities — Notification Center"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "5 notifications marked as read"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.patch("/read-all", notificationCenterController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Mark a single notification as read.
 *     tags: ["10.2 Utilities — Notification Center"]
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Notification marked as read"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.patch("/:id/read", notificationCenterController.markAsRead);

module.exports = router;

export {};
