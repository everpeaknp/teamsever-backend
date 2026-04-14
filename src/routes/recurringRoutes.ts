const express = require("express");
const router = express.Router();
const {
  getRecurringTasks,
  getRecurringTaskInstances,
  stopRecurringTask,
  processRecurringTasks
} = require("../controllers/recurringController");
const { protect } = require("../middlewares/authMiddleware");

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/recurring/workspace/{workspaceId}:
 *   get:
 *     summary: Get all recurring tasks in a workspace
 *     description: Retrieves all active recurring tasks within a workspace
 *     tags: ["4.3 Tasks — Recurring"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: List of recurring tasks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RecurringTaskListResponse"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Workspace not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/workspace/:workspaceId", getRecurringTasks);

/**
 * @swagger
 * /api/recurring/{taskId}/instances:
 *   get:
 *     summary: Get instances of a recurring task
 *     description: |
 *       Retrieves all task instances that were automatically created from a recurring task.
 *       
 *       Each time a recurring task is processed by the cron job, a new instance is created
 *       with isRecurring=false and recurringTaskId pointing to the original task.
 *     tags: ["4.3 Tasks — Recurring"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recurring task ID
 *     responses:
 *       200:
 *         description: List of task instances
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/TaskListResponse"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Recurring task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/:taskId/instances", getRecurringTaskInstances);

/**
 * @swagger
 * /api/recurring/{taskId}/stop:
 *   post:
 *     summary: Stop a recurring task
 *     description: |
 *       Stops a recurring task from creating new instances.
 *       
 *       This sets isRecurring=false and clears the nextOccurrence date.
 *       Existing instances are not affected.
 *     tags: ["4.3 Tasks — Recurring"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recurring task ID
 *     responses:
 *       200:
 *         description: Recurring task stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Task not found or not a recurring task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/:taskId/stop", stopRecurringTask);

/**
 * @swagger
 * /api/recurring/process:
 *   post:
 *     summary: Manually trigger recurring task processing
 *     description: |
 *       Manually triggers the recurring task processor (normally runs via cron every hour).
 *       
 *       **Processing Logic:**
 *       1. Finds all tasks where isRecurring=true AND nextOccurrence <= now
 *       2. Checks if recurrenceEnd has not been exceeded
 *       3. Clones each task (copies title, description, priority, assignee, etc.)
 *       4. Sets cloned task status to 'todo' and isRecurring to false
 *       5. Updates original task's nextOccurrence based on frequency and interval
 *       6. Emits real-time socket events for new tasks
 *       
 *       **Frequency Calculation:**
 *       - daily: adds interval days
 *       - weekly: adds interval * 7 days
 *       - monthly: adds interval months
 *       - custom: adds interval days
 *       
 *       **Use Case:** Testing or immediate processing without waiting for cron
 *     tags: ["4.3 Tasks — Recurring"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Processing completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RecurringTaskProcessResponse"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post("/process", processRecurringTasks);

module.exports = router;

export {};
