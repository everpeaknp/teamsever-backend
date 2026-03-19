const express = require("express");
const router = express.Router();
const attachmentController = require("../controllers/attachmentController");
const { protect } = require("../middlewares/authMiddleware");

/**
 * @swagger
 * /api/tasks/{taskId}/attachments/init-upload:
 *   post:
 *     summary: Initialize Cloudinary upload
 *     description: |
 *       Generates a signed upload URL for direct client-to-Cloudinary uploads.
 *       
 *       **Two-Step Upload Process:**
 *       1. Call this endpoint to get upload credentials
 *       2. Upload file directly to Cloudinary from client
 *       3. Call confirm endpoint with Cloudinary response
 *       
 *       **Benefits:**
 *       - Faster uploads (direct to CDN)
 *       - Reduced server load
 *       - Better user experience
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Upload credentials generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                   description: Cloudinary upload URL
 *                 uploadPreset:
 *                   type: string
 *                   description: Upload preset name
 *                 signature:
 *                   type: string
 *                   description: Signed upload signature
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.post(
  "/tasks/:taskId/attachments/init-upload",
  protect,
  attachmentController.initializeUpload
);

/**
 * @swagger
 * /api/tasks/{taskId}/attachments/confirm:
 *   post:
 *     summary: Confirm Cloudinary upload
 *     description: |
 *       Saves attachment metadata after successful Cloudinary upload.
 *       
 *       **Call this after:**
 *       1. Getting credentials from init-upload
 *       2. Uploading file to Cloudinary
 *       3. Receiving Cloudinary response
 *       
 *       **Automatic Features:**
 *       - Thumbnail generation for images
 *       - File size and MIME type extraction
 *       - Secure URL generation
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cloudinaryUrl
 *               - cloudinaryPublicId
 *               - fileName
 *               - fileSize
 *               - mimeType
 *             properties:
 *               cloudinaryUrl:
 *                 type: string
 *                 description: URL from Cloudinary response
 *               cloudinaryPublicId:
 *                 type: string
 *                 description: Public ID from Cloudinary response
 *               fileName:
 *                 type: string
 *                 description: Original file name
 *               fileSize:
 *                 type: number
 *                 description: File size in bytes
 *               mimeType:
 *                 type: string
 *                 description: File MIME type
 *               thumbnailUrl:
 *                 type: string
 *                 description: Thumbnail URL (optional, for images)
 *     responses:
 *       201:
 *         description: Attachment saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.post(
  "/tasks/:taskId/attachments/confirm",
  protect,
  attachmentController.confirmUpload
);

/**
 * @swagger
 * /api/tasks/{taskId}/attachments:
 *   get:
 *     summary: Get all attachments for a task
 *     description: Retrieves all file attachments associated with a task from Cloudinary
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: List of attachments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attachment'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
router.get(
  "/tasks/:taskId/attachments",
  protect,
  attachmentController.getTaskAttachments
);

/**
 * @swagger
 * /api/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete an attachment
 *     description: |
 *       Deletes an attachment from both the database and Cloudinary.
 *       
 *       **Cleanup Process:**
 *       1. Removes file from Cloudinary using public_id
 *       2. Deletes database record
 *       3. Returns confirmation
 *       
 *       **Automatic Cleanup:**
 *       When a task is hard-deleted, all attachments are automatically removed.
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Attachment deleted successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 */
router.delete(
  "/attachments/:attachmentId",
  protect,
  attachmentController.deleteAttachment
);

module.exports = router;

export {};
