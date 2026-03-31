const express = require("express");
const {
  createSpace,
  getWorkspaceSpaces,
  getSpace,
  getSpaceMetadata,
  getSpaceListsMetadata,
  updateSpace,
  deleteSpace,
  addMemberToSpace,
  removeMemberFromSpace,
  inviteExternalUsers
} = require("../controllers/spaceController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkSpaceLimit } = require("../middlewares/subscriptionMiddleware");
const validate = require("../utils/validation");
const { createSpaceSchema, updateSpaceSchema } = require("../validators/spaceValidators");

/**
 * @swagger
 * tags:
 *   name: "Project Hierarchy"
 *   description: "Space management within workspaces"
 */

// Workspace-scoped router
const workspaceSpaceRouter = express.Router({ mergeParams: true });

/**
 * @swagger
 * /api/workspaces/{workspaceId}/spaces:
 *   post:
 *     summary: Create space
 *     description: Create a new space in a workspace
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
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
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       201:
 *         description: Space created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SpaceResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Space limit reached or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   get:
 *     summary: Get workspace spaces
 *     description: Retrieve all spaces in a workspace
 *     tags: ["Project Hierarchy"]
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
 *         description: Spaces retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SpaceListResponse"
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
workspaceSpaceRouter.post("/", protect, requirePermission("CREATE_SPACE"), checkSpaceLimit, validate(createSpaceSchema), createSpace);
workspaceSpaceRouter.get("/", protect, requirePermission("VIEW_SPACE"), getWorkspaceSpaces);

// Standalone space router
const spaceRouter = express.Router();

/**
 * @swagger
 * /api/spaces/{id}:
 *   get:
 *     summary: Get space
 *     description: Retrieve a specific space by ID
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SpaceResponse"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   patch:
 *     summary: Update space
 *     description: Update space details
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       200:
 *         description: Space updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SpaceResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   delete:
 *     summary: Delete space
 *     description: Delete a space and its contents
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space deleted successfully
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
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceRouter.get("/:id", protect, requirePermission("VIEW_SPACE"), getSpace);

/**
 * @swagger
 * /api/spaces/{id}/metadata:
 *   get:
 *     summary: Get space metadata
 *     description: Returns lightweight metadata for a space (name, members count, settings) without full nested data
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: Space metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 workspace:
 *                   type: string
 *                 color:
 *                   type: string
 *                 icon:
 *                   type: string
 *                 membersCount:
 *                   type: number
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *
 * /api/spaces/{id}/lists/metadata:
 *   get:
 *     summary: Get space lists metadata
 *     description: Returns all lists within a space with lightweight metadata (no task data). Useful for sidebar/navigation rendering.
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *     responses:
 *       200:
 *         description: List metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   space:
 *                     type: string
 *                   workspace:
 *                     type: string
 *                   folder:
 *                     type: string
 *                     nullable: true
 *                     description: Parent folder ID if list is inside a folder
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceRouter.get("/:id/metadata", protect, requirePermission("VIEW_SPACE"), getSpaceMetadata);
spaceRouter.get("/:id/lists/metadata", protect, requirePermission("VIEW_SPACE"), getSpaceListsMetadata);
spaceRouter.patch("/:id", protect, requirePermission("UPDATE_SPACE"), require("../middlewares/ownerOnly"), validate(updateSpaceSchema), updateSpace);
spaceRouter.delete("/:id", protect, requirePermission("DELETE_SPACE"), deleteSpace);

/**
 * @swagger
 * /api/spaces/{id}/members:
 *   post:
 *     summary: Add member to space
 *     description: Add a workspace member to a space
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member added successfully
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
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceRouter.post("/:id/members", protect, requirePermission("ADD_SPACE_MEMBER"), addMemberToSpace);

/**
 * @swagger
 * /api/spaces/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from space
 *     description: Remove a member from a space
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Space ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Member removed successfully
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
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceRouter.delete("/:id/members/:userId", protect, requirePermission("REMOVE_SPACE_MEMBER"), removeMemberFromSpace);

/**
 * @swagger
 * /api/spaces/{id}/invite-external:
 *   post:
 *     summary: Invite external users to space
 *     description: Invite users who are not workspace members to a space
 *     tags: ["Project Hierarchy"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - emails
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Invitations sent successfully
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
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Space not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
spaceRouter.post("/:id/invite-external", protect, requirePermission("INVITE_MEMBER"), inviteExternalUsers);

module.exports = { workspaceSpaceRouter, spaceRouter };

export {};
