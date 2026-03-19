"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createSpace, getWorkspaceSpaces, getSpace, getSpaceMetadata, getSpaceListsMetadata, updateSpace, deleteSpace, addMemberToSpace, removeMemberFromSpace, inviteExternalUsers } = require("../controllers/spaceController");
const { protect } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../permissions/permission.middleware");
const { checkSpaceLimit } = require("../middlewares/subscriptionMiddleware");
const validate = require("../utils/validation");
const { createSpaceSchema, updateSpaceSchema } = require("../validators/spaceValidators");
/**
 * @swagger
 * tags:
 *   name: Spaces
 *   description: Space management within workspaces
 */
// Workspace-scoped router
const workspaceSpaceRouter = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/workspaces/{workspaceId}/spaces:
 *   post:
 *     summary: Create space
 *     description: Create a new space in a workspace
 *     tags: [Spaces]
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Space limit reached or insufficient permissions
 *   get:
 *     summary: Get workspace spaces
 *     description: Retrieve all spaces in a workspace
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Workspace not found
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
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Space not found
 *   patch:
 *     summary: Update space
 *     description: Update space details
 *     tags: [Spaces]
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
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space not found
 *   delete:
 *     summary: Delete space
 *     description: Delete a space and its contents
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space not found
 */
spaceRouter.get("/:id", protect, requirePermission("VIEW_SPACE"), getSpace);
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
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space or user not found
 */
spaceRouter.post("/:id/members", protect, requirePermission("ADD_SPACE_MEMBER"), addMemberToSpace);
/**
 * @swagger
 * /api/spaces/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from space
 *     description: Remove a member from a space
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space or user not found
 */
spaceRouter.delete("/:id/members/:userId", protect, requirePermission("REMOVE_SPACE_MEMBER"), removeMemberFromSpace);
/**
 * @swagger
 * /api/spaces/{id}/invite-external:
 *   post:
 *     summary: Invite external users to space
 *     description: Invite users who are not workspace members to a space
 *     tags: [Spaces]
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
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Space not found
 */
spaceRouter.post("/:id/invite-external", protect, requirePermission("INVITE_MEMBER"), inviteExternalUsers);
module.exports = { workspaceSpaceRouter, spaceRouter };
