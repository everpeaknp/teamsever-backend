const express = require("express");
const { getMyProfile, updateProfile } = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadSingle, handleUploadError } = require("../middlewares/uploadMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile details of the authenticated user.
 *     tags: ["1. Auth & Identity"]
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
 */
router.get("/profile", protect, getMyProfile);

/**
 * @swagger
 * /api/users/profile:
 *   patch:
 *     summary: Update user profile
 *     description: Update name, job title, department, bio, and profile picture. Uses multipart/form-data for file uploads.
 *     tags: ["1. Auth & Identity"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Updated"
 *               jobTitle:
 *                 type: string
 *                 example: "Senior Developer"
 *               department:
 *                 type: string
 *                 example: "Platform Team"
 *               bio:
 *                 type: string
 *                 example: "Passionate about scalable systems."
 *               removeAvatar:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'false'
 *                 description: Set to 'true' to delete the current profile picture
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: New profile picture file
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
router.patch(
  "/profile",
  protect,
  uploadSingle,
  handleUploadError,
  updateProfile
);

module.exports = router;
export {};
