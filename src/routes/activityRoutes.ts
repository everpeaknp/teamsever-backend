const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get activity logs
 *     description: |
 *       Retrieve activity logs with optional filters.
 *       **Access Control:** Owners/Admins see all workspace activity; regular members see only their own logs.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *         description: Filter by workspace
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *         description: Filter by specific task
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of results
 *     responses:
 *       200:
 *         description: Activities retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityListResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get(
  "/activities",
  protect,
  activityController.getActivities
);

/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   get:
 *     summary: Get task comments
 *     description: Retrieve all comments for a specific task.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
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
 *         description: Comments retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityListResponse"
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
router.get(
  "/tasks/:taskId/comments",
  protect,
  (req: any, res: any, next: any) => {
    req.query.type = 'comment';
    next();
  },
  activityController.getTaskActivity
);

/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   post:
 *     summary: Add comment to task
 *     description: Post a new comment on a task. Supports @mentions by including user IDs in the `mentions` array.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
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
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CommentCreateInput"
 *     responses:
 *       201:
 *         description: Comment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/tasks/:taskId/comments",
  protect,
  requirePermission("COMMENT_TASK"),
  activityController.createComment
);

/**
 * @swagger
 * /api/tasks/{taskId}/activity:
 *   get:
 *     summary: Get task activity feed
 *     description: Returns all activity (comments, status changes, assignments) for a specific task, newest first.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
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
 *         description: Task activity retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityListResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get(
  "/tasks/:taskId/activity",
  protect,
  activityController.getTaskActivity
);

router.get(
  "/folders/:folderId/activity",
  protect,
  activityController.getFolderActivity
);

/**
 * @swagger
 * /api/folders/{folderId}/activity:
 *   get:
 *     summary: Get folder activity feed
 *     description: Aggregates activity from all lists inside the folder and returns a unified, time-sorted feed.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: skip
 *         required: false
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Folder activity retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Folder not found
 */

/**
 * @swagger
 * /api/activities/{activityId}:
 *   put:
 *     summary: Edit comment
 *     description: Edit an existing comment. Only the comment author can edit it.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CommentUpdateInput"
 *     responses:
 *       200:
 *         description: Comment updated/deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete comment
 *     description: Delete a comment. Author or workspace admin can delete.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment updated/deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.put(
  "/activities/:activityId",
  protect,
  activityController.updateComment
);
router.delete(
  "/activities/:activityId",
  protect,
  activityController.deleteComment
);

/**
 * @swagger
 * /api/activities/{activityId}/reactions:
 *   post:
 *     summary: Add emoji reaction
 *     description: Add an emoji reaction to a comment. If the same emoji already exists from the user, it toggles off.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Remove emoji reaction
 *     description: Remove your emoji reaction from a comment.
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: "👍"
 *     responses:
 *       200:
 *         description: Reaction updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post(
  "/activities/:activityId/reactions",
  protect,
  activityController.addReaction
);
router.delete(
  "/activities/:activityId/reactions",
  protect,
  activityController.removeReaction
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/activity:
 *   get:
 *     summary: Get workspace activity feed
 *     description: |
 *       Returns activity logs for the entire workspace.
 *       **Access Control:**
 *       - **Owners/Admins:** See all workspace activity
 *       - **Members:** See only their own personal activity
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Workspace activity retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ActivityListResponse"
 *       401:
 *         description: Authentication required
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
router.get(
  "/workspaces/:workspaceId/activity",
  protect,
  activityController.getUserActivity
);

/**
 * @swagger
 * /api/spaces/{spaceId}/commits:
 *   get:
 *     summary: Get space GitHub commits
 *     tags: ["5.1 Collaboration — Activity & Comments"]
 */
router.get(
  "/spaces/:spaceId/commits",
  protect,
  activityController.getSpaceCommits
);

module.exports = router;

export {};
