"use strict";
/**
 * @swagger
 * /api/gantt/workspaces/{workspaceId}/tasks:
 *   get:
 *     summary: Get Gantt chart tasks
 *     description: Returns all tasks with start/due dates for Gantt chart visualization
 *     tags: [Gantt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: spaceId
 *         schema:
 *           type: string
 *         description: Filter by space ID
 *       - in: query
 *         name: listId
 *         schema:
 *           type: string
 *         description: Filter by list ID
 *     responses:
 *       200:
 *         description: List of tasks with dates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workspace not found
 *
 * /api/gantt/tasks/{taskId}/dependencies:
 *   get:
 *     summary: Get task dependencies
 *     description: Returns all dependencies for a task
 *     tags: [Gantt]
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
 *         description: List of dependencies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TaskDependency'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   post:
 *     summary: Add task dependency
 *     description: |
 *       Creates a dependency between two tasks.
 *       
 *       **Dependency Types:**
 *       - FS (Finish-to-Start): Target starts when source finishes
 *       - SS (Start-to-Start): Target starts when source starts
 *       - FF (Finish-to-Finish): Target finishes when source finishes
 *       - SF (Start-to-Finish): Target finishes when source starts
 *       
 *       **Auto-scheduling:** When a dependency is created, the system automatically
 *       adjusts task dates to respect the dependency relationship.
 *     tags: [Gantt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target task ID (depends on source)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceTaskId
 *             properties:
 *               sourceTaskId:
 *                 type: string
 *                 description: Source task ID (must be completed first)
 *               type:
 *                 type: string
 *                 enum: [FS, SS, FF, SF]
 *                 default: FS
 *                 description: Dependency type
 *     responses:
 *       201:
 *         description: Dependency created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskDependency'
 *       400:
 *         description: Validation error or circular dependency detected
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *
 * /api/gantt/dependencies/{id}:
 *   delete:
 *     summary: Remove task dependency
 *     description: Removes a dependency between tasks
 *     tags: [Gantt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Dependency ID
 *     responses:
 *       200:
 *         description: Dependency removed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Dependency not found
 */
Object.defineProperty(exports, "__esModule", { value: true });
