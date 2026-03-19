"use strict";
/**
 * @swagger
 * /api/tasks/{taskId}/attachments:
 *   get:
 *     summary: Get task attachments
 *     description: Returns all attachments for a task
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
 *   post:
 *     summary: Upload attachment
 *     description: Uploads a file attachment to a task via Cloudinary
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: No file provided or invalid file
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *
 * /api/attachments/{id}:
 *   delete:
 *     summary: Delete attachment
 *     description: Deletes an attachment from task and Cloudinary
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attachment ID
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
