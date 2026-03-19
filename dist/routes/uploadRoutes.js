"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadSingle, handleUploadError } = require("../middlewares/uploadMiddleware");
/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: File upload management
 */
/**
 * @swagger
 * /api/upload/tasks/{taskId}/attachments:
 *   post:
 *     summary: Upload task attachment
 *     description: Upload a file attachment to a task
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 *   get:
 *     summary: Get task attachments
 *     description: Retrieve all attachments for a task
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 */
router.post("/tasks/:taskId/attachments", protect, uploadSingle, handleUploadError, uploadController.uploadTaskAttachment);
router.get("/tasks/:taskId/attachments", protect, uploadController.getTaskAttachments);
/**
 * @swagger
 * /api/upload/comments/{commentId}/attachments:
 *   post:
 *     summary: Upload comment attachment
 *     description: Upload a file attachment to a comment
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 *   get:
 *     summary: Get comment attachments
 *     description: Retrieve all attachments for a comment
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 */
router.post("/comments/:commentId/attachments", protect, uploadSingle, handleUploadError, uploadController.uploadCommentAttachment);
router.get("/comments/:commentId/attachments", protect, uploadController.getCommentAttachments);
/**
 * @swagger
 * /api/upload/dm/{conversationId}/attachments:
 *   post:
 *     summary: Upload DM attachment
 *     description: Upload a file attachment to a direct message
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 *   get:
 *     summary: Get conversation attachments
 *     description: Retrieve all attachments in a conversation
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 */
router.post("/dm/:conversationId/attachments", protect, uploadSingle, handleUploadError, uploadController.uploadDMAttachment);
router.get("/dm/:conversationId/attachments", protect, uploadController.getConversationAttachments);
/**
 * @swagger
 * /api/upload/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete attachment
 *     description: Delete a file attachment
 *     tags: [Upload]
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Attachment not found
 */
router.delete("/attachments/:attachmentId", protect, uploadController.deleteAttachment);
module.exports = router;
