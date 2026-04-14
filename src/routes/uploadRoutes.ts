const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadSingle, handleUploadError } = require("../middlewares/uploadMiddleware");

/**
 * @swagger
 * /api/upload/tasks/{taskId}/attachments:
 *   post:
 *     summary: Upload task attachment
 *     description: Upload a file attachment to a task
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get task attachments
 *     description: Retrieve all attachments for a task
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/tasks/:taskId/attachments",
  protect,
  uploadSingle,
  handleUploadError,
  uploadController.uploadTaskAttachment
);

router.get(
  "/tasks/:taskId/attachments",
  protect,
  uploadController.getTaskAttachments
);

/**
 * @swagger
 * /api/upload/comments/{commentId}/attachments:
 *   post:
 *     summary: Upload comment attachment
 *     description: Upload a file attachment to a comment
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get comment attachments
 *     description: Retrieve all attachments for a comment
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/comments/:commentId/attachments",
  protect,
  uploadSingle,
  handleUploadError,
  uploadController.uploadCommentAttachment
);

router.get(
  "/comments/:commentId/attachments",
  protect,
  uploadController.getCommentAttachments
);

/**
 * @swagger
 * /api/upload/dm/{conversationId}/attachments:
 *   post:
 *     summary: Upload DM attachment
 *     description: Upload a file attachment to a direct message
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get conversation attachments
 *     description: Retrieve all attachments in a conversation
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/dm/:conversationId/attachments",
  protect,
  uploadSingle,
  handleUploadError,
  uploadController.uploadDMAttachment
);

router.get(
  "/dm/:conversationId/attachments",
  protect,
  uploadController.getConversationAttachments
);

/**
 * @swagger
 * /api/upload/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete attachment
 *     description: Delete a file attachment
 *     tags: ["6.1 Files — Uploads (Cloudinary)"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Attachment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.delete(
  "/attachments/:attachmentId",
  protect,
  uploadController.deleteAttachment
);

module.exports = router;

export {};
