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

/**
 * @swagger
 * /api/notifications/fcm-token:
 *   post:
 *     summary: Register FCM token
 *     description: Register Firebase Cloud Messaging token for web push notifications
 *     tags: ["10. Utilities & Search"]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/NotificationResponse"
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
 * /api/notifications/register:
 *   post:
 *     summary: Register device
 *     description: Register a device for push notifications
 *     tags: ["10. Utilities & Search"]
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
 *               - platform
 *             properties:
 *               token:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android]
 *     responses:
 *       200:
 *         description: Device registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/NotificationResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/register",
  validate(registerDeviceSchema),
  notificationController.registerDevice
);

/**
 * @swagger
 * /api/notifications/unregister:
 *   delete:
 *     summary: Unregister device
 *     description: Unregister a device from push notifications
 *     tags: ["10. Utilities & Search"]
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
 *         description: Device unregistered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/NotificationResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.delete(
  "/unregister",
  validate(unregisterDeviceSchema),
  notificationController.unregisterDevice
);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get registered devices
 *     description: Retrieve all registered devices for the current user
 *     tags: ["10. Utilities & Search"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Devices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/NotificationResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/", notificationController.getDevices);

module.exports = router;

export {};
