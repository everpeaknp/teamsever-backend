const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const {
  registerDeviceSchema,
  unregisterDeviceSchema,
} = require("../validators/notificationValidators");

// All routes require authentication
router.use(protect);

// This file is mounted at /api/notifications/devices
// So routes here resolve to /api/notifications/devices/...

/**
 * @swagger
 * /api/notifications/devices/fcm-token:
 *   post:
 *     summary: Register FCM token (Simplified)
 *     description: Register a raw FCM token for the current user.
 *     tags: ["10.3 Utilities — Push Notification Devices"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken: { type: string }
 *     responses:
 *       200:
 *         description: Token registered
 */
router.post("/fcm-token", notificationController.registerFCMToken);

/**
 * @swagger
 * /api/notifications/devices/register:
 *   post:
 *     summary: Register device details
 *     description: Register full device details including platform and FCM token.
 *     tags: ["10.3 Utilities — Push Notification Devices"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token: { type: string }
 *               platform: { type: string, enum: [web, ios, android] }
 *     responses:
 *       200:
 *         description: Device registered
 */
router.post("/register", validate(registerDeviceSchema), notificationController.registerDevice);

/**
 * @swagger
 * /api/notifications/devices/unregister:
 *   delete:
 *     summary: Unregister device
 *     tags: ["10.3 Utilities — Push Notification Devices"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Device unregistered
 */
router.delete("/unregister", validate(unregisterDeviceSchema), notificationController.unregisterDevice);

/**
 * @swagger
 * /api/notifications/devices:
 *   get:
 *     summary: List registered devices
 *     tags: ["10.3 Utilities — Push Notification Devices"]
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/", notificationController.getDevices);

module.exports = router;

export {};
