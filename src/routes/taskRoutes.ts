const express = require("express");
const {
  createTask,
  getListTasks,
  getTask,
  updateTask,
  deleteTask,
  createSubtask,
  getSubtasks,
  addDependency,
  removeDependency,
  getDependencies,
  getDependents
} = require("../controllers/taskController");
const { protect } = require("../middlewares/authMiddleware");
const { checkTaskLimit } = require("../middlewares/subscriptionMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const validate = require("../utils/validation");
const { 
  createTaskSchema, 
  updateTaskSchema,
  createSubtaskSchema,
  addDependencySchema
} = require("../validators/taskValidators");

// List-scoped router
const listTaskRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/lists/{listId}/tasks:
 *   post:
 *     summary: Create a new task
 *     description: Creates a new task within a specific list. Supports regular tasks, recurring tasks, and milestones.
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: The list ID where the task will be created
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *                 example: "Implement user authentication"
 *               description:
 *                 type: string
 *                 description: Detailed task description
 *                 example: "Add JWT-based authentication with refresh tokens"
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *                 default: todo
 *                 description: Task status
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Task priority level
 *               assignee:
 *                 type: string
 *                 description: User ID of the assignee
 *                 example: "507f1f77bcf86cd799439011"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *                 example: "2026-03-01T00:00:00Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Task start date (for Gantt charts)
 *                 example: "2026-02-20T00:00:00Z"
 *               isMilestone:
 *                 type: boolean
 *                 description: Whether this is a milestone (startDate must equal dueDate)
 *                 example: false
 *               isRecurring:
 *                 type: boolean
 *                 description: Whether this task should recur automatically
 *                 example: false
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, custom]
 *                 description: Recurrence frequency (required if isRecurring is true)
 *                 example: "weekly"
 *               interval:
 *                 type: number
 *                 description: Recurrence interval (e.g., every 2 weeks)
 *                 example: 1
 *               nextOccurrence:
 *                 type: string
 *                 format: date-time
 *                 description: Next scheduled occurrence (required if isRecurring is true)
 *                 example: "2026-02-24T00:00:00Z"
 *               recurrenceEnd:
 *                 type: string
 *                 format: date-time
 *                 description: When recurrence should stop (optional)
 *                 example: "2026-12-31T00:00:00Z"
 *               customFieldValues:
 *                 type: array
 *                 description: Custom field values for this task
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                       description: Custom field ID
 *                     value:
 *                       type: string
 *                       description: Field value
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: List not found
 *   get:
 *     summary: Get all tasks in a list
 *     description: Retrieves all tasks within a specific list with optional filtering
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: The list ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in-progress, done]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *         description: Filter by assignee user ID
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: List not found
 */
listTaskRouter.post("/", protect, checkTaskLimit, requirePermission("CREATE_TASK"), validate(createTaskSchema), createTask);
listTaskRouter.get("/", protect, requirePermission("VIEW_TASK"), getListTasks);

// Standalone task router
const taskRouter = express.Router();

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a single task
 *     description: Retrieves detailed information about a specific task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   patch:
 *     summary: Update a task
 *     description: |
 *       Updates task properties. Automatically tracks changes and creates activity entries.
 *       
 *       **Auto-tracked fields:**
 *       - Status changes
 *       - Assignee changes
 *       - Priority changes
 *       - Due date changes
 *       - Start date changes
 *       - Title changes
 *       
 *       **Gantt Integration:**
 *       When startDate or dueDate is changed, dependent tasks are automatically cascaded
 *       based on their dependency type (FS, SS, FF, SF).
 *       
 *       **Completion Tracking:**
 *       When status changes to 'done', completedAt timestamp is automatically set.
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *               description:
 *                 type: string
 *                 description: Task description
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *                 description: Task status (triggers completedAt when set to 'done')
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Task priority
 *               assignee:
 *                 type: string
 *                 description: Assignee user ID
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Due date (triggers dependency cascade if changed)
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date (triggers dependency cascade if changed)
 *           example:
 *             status: "in-progress"
 *             priority: "high"
 *             assignee: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 *   delete:
 *     summary: Delete a task
 *     description: Soft deletes a task (sets isDeleted flag). Also cleans up associated attachments from Cloudinary.
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Task deleted successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Task not found
 */
taskRouter.get("/:id", protect, requirePermission("VIEW_TASK"), getTask);
taskRouter.patch("/:id", protect, requirePermission("EDIT_TASK"), validate(updateTaskSchema), updateTask);
taskRouter.delete("/:id", protect, requirePermission("DELETE_TASK"), deleteTask);

/**
 * @swagger
 * /api/tasks/{taskId}/subtasks:
 *   post:
 *     summary: Create a subtask
 *     description: Creates a subtask under a parent task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Subtask title
 *               description:
 *                 type: string
 *                 description: Subtask description
 *               assignee:
 *                 type: string
 *                 description: Assignee user ID
 *     responses:
 *       201:
 *         description: Subtask created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Parent task not found
 *   get:
 *     summary: Get all subtasks
 *     description: Retrieves all subtasks of a parent task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent task ID
 *     responses:
 *       200:
 *         description: List of subtasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Parent task not found
 */
taskRouter.post("/:taskId/subtasks", protect, checkTaskLimit, requirePermission("CREATE_TASK"), validate(createSubtaskSchema), createSubtask);
taskRouter.get("/:taskId/subtasks", protect, requirePermission("VIEW_TASK"), getSubtasks);

/**
 * @swagger
 * /api/tasks/{taskId}/dependencies:
 *   post:
 *     summary: Add a task dependency
 *     description: |
 *       Creates a dependency relationship between two tasks for Gantt chart functionality.
 *       
 *       **Dependency Types:**
 *       - **FS (Finish-to-Start):** Target task can't start until source task finishes
 *       - **SS (Start-to-Start):** Target task can't start until source task starts
 *       - **FF (Finish-to-Finish):** Target task can't finish until source task finishes
 *       - **SF (Start-to-Finish):** Target task can't finish until source task starts
 *       
 *       **Cascading Logic:**
 *       When the source task's dates change, the target task's dates are automatically
 *       adjusted based on the dependency type. This cascades through the entire dependency chain.
 *       
 *       **Circular Dependency Protection:**
 *       The system prevents circular dependencies using a visited set during cascade operations.
 *     tags: [Task Dependencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target task ID (the task that depends on another)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dependencySource
 *               - type
 *             properties:
 *               dependencySource:
 *                 type: string
 *                 description: Source task ID (the task that must be completed first)
 *                 example: "507f1f77bcf86cd799439011"
 *               type:
 *                 type: string
 *                 enum: [FS, SS, FF, SF]
 *                 description: Dependency type
 *                 example: "FS"
 *           example:
 *             dependencySource: "507f1f77bcf86cd799439011"
 *             type: "FS"
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
 *   get:
 *     summary: Get task dependencies (blockers)
 *     description: Retrieves all tasks that the current task depends on (tasks blocking this one)
 *     tags: [Task Dependencies]
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
 */
taskRouter.post("/:taskId/dependencies", protect, requirePermission("EDIT_TASK"), validate(addDependencySchema), addDependency);
taskRouter.get("/:taskId/dependencies", protect, requirePermission("VIEW_TASK"), getDependencies);

/**
 * @swagger
 * /api/tasks/{taskId}/dependencies/{depId}:
 *   delete:
 *     summary: Remove a task dependency
 *     description: Removes a dependency relationship between two tasks
 *     tags: [Task Dependencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: path
 *         name: depId
 *         required: true
 *         schema:
 *           type: string
 *         description: Dependency ID to remove
 *     responses:
 *       200:
 *         description: Dependency removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Dependency removed successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Dependency not found
 */
taskRouter.delete("/:taskId/dependencies/:depId", protect, requirePermission("EDIT_TASK"), removeDependency);

/**
 * @swagger
 * /api/tasks/{taskId}/dependents:
 *   get:
 *     summary: Get dependent tasks (blocked tasks)
 *     description: Retrieves all tasks that depend on the current task (tasks blocked by this one)
 *     tags: [Task Dependencies]
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
 *         description: List of dependent tasks
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
 */
taskRouter.get("/:taskId/dependents", protect, requirePermission("VIEW_TASK"), getDependents);

module.exports = { listTaskRouter, taskRouter };

export {};
