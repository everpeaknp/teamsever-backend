"use strict";
/**
 * @swagger
 * /api/tasks/{taskId}/activities:
 *   get:
 *     summary: Get task activities
 *     description: Returns all activities (comments and updates) for a task
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of activities to return
 *     responses:
 *       200:
 *         description: List of activities
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Activity'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   post:
 *     summary: Add activity (comment)
 *     description: Adds a new comment to a task
 *     tags: [Activities]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Comment content
 *                 example: "This looks good! Let's proceed."
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs mentioned
 *     responses:
 *       201:
 *         description: Activity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Activity'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *
 * /api/activities/{id}:
 *   patch:
 *     summary: Update activity
 *     description: Updates an activity (comment only, not system-generated updates)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Activity updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot edit system-generated activities
 *       404:
 *         description: Activity not found
 *   delete:
 *     summary: Delete activity
 *     description: Deletes an activity (comment only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     responses:
 *       200:
 *         description: Activity deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot delete system-generated activities
 *       404:
 *         description: Activity not found
 *
 * /api/activities/{id}/reactions:
 *   post:
 *     summary: Add reaction to activity
 *     description: Adds an emoji reaction to an activity
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 description: Emoji reaction
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction added successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Activity not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
