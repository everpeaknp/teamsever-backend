"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const presenceService = require("../services/presenceService");
const asyncHandler = require("../utils/asyncHandler");
/**
 * Get workspace presence
 * GET /api/presence/:workspaceId
 */
const getWorkspacePresence = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const presence = await presenceService.getWorkspacePresence(workspaceId, userId);
    res.json({
        success: true,
        data: presence,
    });
});
/**
 * Get online users in workspace
 * GET /api/presence/:workspaceId/online
 */
const getOnlineUsers = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const onlineUsers = await presenceService.getOnlineUsersInWorkspace(workspaceId, userId);
    res.json({
        success: true,
        data: {
            onlineUsers,
            count: onlineUsers.length,
        },
    });
});
/**
 * Get user presence status
 * GET /api/presence/user/:userId
 */
const getUserPresence = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const presence = presenceService.getUserPresence(userId);
    res.json({
        success: true,
        data: presence,
    });
});
module.exports = {
    getWorkspacePresence,
    getOnlineUsers,
    getUserPresence,
};
