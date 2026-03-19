"use strict";
/**
 * @swagger
 * /api/spaces/{spaceId}/lists:
 *   get:
 *     summary: Get all lists in a space
 *     description: Returns all lists within a specific space
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: List of lists
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/List'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Space not found
 *   post:
 *     summary: Create a new list
 *     description: Creates a new list within a space
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: List name
 *                 example: "Sprint 1"
 *     responses:
 *       201:
 *         description: List created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/List'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *
 * /api/lists/{id}:
 *   get:
 *     summary: Get list by ID
 *     description: Returns detailed list information
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     responses:
 *       200:
 *         description: List details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/List'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: List not found
 *   patch:
 *     summary: Update list
 *     description: Updates list properties
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: List updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: List not found
 *   delete:
 *     summary: Delete list
 *     description: Deletes a list and all its tasks
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: List ID
 *     responses:
 *       200:
 *         description: List deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: List not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
