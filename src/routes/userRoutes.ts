const express = require("express");
const { getMyProfile, updateProfile, updateNotificationPreferences } = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadSingle, handleUploadError } = require("../middlewares/uploadMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile details of the authenticated user.
 *     tags: ["1.2 Auth — Password & Profile"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   patch:
 *     summary: Update user profile
 *     description: Update name, job title, department, bio, and profile picture. Uses multipart/form-data for file uploads.
 *     tags: ["1.2 Auth — Password & Profile"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/UserProfileUpdateInput"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/UserResponse"
 *       400:
 *         description: Invalid input data
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
router.get("/profile", protect, getMyProfile);
router.patch(
  "/profile",
  protect,
  uploadSingle,
  handleUploadError,
  updateProfile
);

/**
 * @swagger
 * /api/users/notification-preferences:
 *   patch:
 *     summary: Update notification preferences
 *     description: Toggle notifications for GitHub commits, tasks, messages, etc.
 *     tags: ["1.2 Auth — Password & Profile"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/NotificationPreferences"
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: "object"
 *               properties:
 *                 success: { type: "boolean", example: true }
 *                 data: { $ref: "#/components/schemas/NotificationPreferences" }
 */
router.patch("/notification-preferences", protect, updateNotificationPreferences);

module.exports = router;
export {};
