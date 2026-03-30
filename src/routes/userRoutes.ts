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
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bce50b96fe109fe4e14ff6"
 *                 name: "John Doe"
 *                 email: "john@example.com"
 *                 jobTitle: "Developer"
 *                 department: "Engineering"
 *                 bio: "Loves coding and coffee."
 *                 avatar: "https://res.cloudinary.com/example/image/upload/avatar.jpg"
 *                 createdAt: "2026-01-15T08:00:00Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/profile", protect, getMyProfile);

/**
 * @swagger
 * /api/users/profile:
 *   patch:
 *     summary: Update user profile
 *     description: Update name, job title, department, bio, and profile picture. Uses multipart/form-data for file uploads.
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               message: "Profile updated successfully"
 *               data:
 *                 _id: "69bce50b96fe109fe4e14ff6"
 *                 name: "John Updated"
 *                 jobTitle: "Senior Developer"
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
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
