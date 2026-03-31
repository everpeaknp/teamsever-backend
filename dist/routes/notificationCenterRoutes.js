"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const notificationCenterController = require("../controllers/notificationCenterController");
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");
/**
 * @swagger
 * tags:
 *   name: Notification Center
 *   description: In-app notification center (list, mark-read) + FCM device token registration for push notifications
 */
// All routes require authentication
router.use(protect);
/**
 * @swagger
 * /api/notification-center/fcm-token:
 *   post:
 *     summary: Register FCM device token
 *     description: Register a Firebase Cloud Messaging (FCM) token for push notifications. Call this when the app launches and gets a valid FCM token from Firebase.
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
 */
router.post("/fcm-token", notificationController.registerFCMToken);
/**
 * @swagger
 * /api/notification-center:
 *   get:
 *     summary: Get notifications
 *     description: Retrieve the current user's in-app notifications, newest first.
 *     tags: [Notification Center]
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
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f71675800"
 *                   type: "task_assigned"
 *                   title: "Task Assigned to You"
 *                   message: "Alice assigned 'Implement OAuth2' to you"
 *                   isRead: false
 *                   createdAt: "2026-03-30T08:00:00Z"
 *                   relatedTask: "69bbf827a96fe78f716755f4"
 *                   relatedWorkspace: "69bbf827a96fe78f716752bb"
 *                 - _id: "69bbf827a96fe78f71675801"
 *                   type: "comment_mention"
 *                   title: "You were mentioned"
 *                   message: "Bob mentioned you in a comment"
 *                   isRead: true
 *                   createdAt: "2026-03-29T15:30:00Z"
 *                   relatedTask: "69bbf827a96fe78f716755f5"
 *                   relatedWorkspace: "69bbf827a96fe78f716752bb"
 *               total: 14
 *               unread: 3
 *       401:
 *         description: Authentication required
 */
router.get("/", notificationCenterController.getNotifications);
/**
 * @swagger
 * /api/notification-center/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Returns the count of unread notifications. Use this to display the badge number on the notification bell icon.
 *     tags: [Notification Center]
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
 */
router.get("/unread-count", notificationCenterController.getUnreadCount);
/**
 * @swagger
 * /api/notification-center/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     description: Marks all the current user's unread notifications as read. Useful when user opens the notification panel.
 *     tags: [Notification Center]
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
 */
router.patch("/read-all", notificationCenterController.markAllAsRead);
/**
 * @swagger
 * /api/notification-center/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Mark a single notification as read.
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Notification marked as read"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", notificationCenterController.markAsRead);
module.exports = router;
