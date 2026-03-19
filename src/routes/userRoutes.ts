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
 *     description: Retrieve the profile details of the authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get("/profile", protect, getMyProfile);

/**
 * @swagger
 * /api/users/profile:
 *   patch:
 *     summary: Update user profile
 *     description: Update name, job title, department, bio, and profile picture
 *     tags: [Users]
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
 *               jobTitle:
 *                 type: string
 *               department:
 *                 type: string
 *               bio:
 *                 type: string
 *               removeAvatar:
 *                 type: string
 *                 enum: ['true', 'false']
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
