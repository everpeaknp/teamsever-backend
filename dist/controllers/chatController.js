"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chatService = require("../services/chatService");
const asyncHandler = require("../utils/asyncHandler");
/**
 * @desc    Create a new chat channel
 * @route   POST /api/workspaces/:workspaceId/chat/channels
 * @access  Private (Admin/Owner only)
 */
const createChannel = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { name, description, type, members } = req.body;
    const userId = req.user.id;
    const channel = await chatService.createChannel(workspaceId, userId, {
        name,
        description,
        type,
        members,
    });
    res.status(201).json({
        success: true,
        data: channel,
    });
});
/**
 * @desc    Get all accessible channels in a workspace
 * @route   GET /api/workspaces/:workspaceId/chat/channels
 * @access  Private (workspace members only)
 */
const getChannels = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    const channels = await chatService.getChannels(workspaceId, userId);
    res.status(200).json({
        success: true,
        data: channels,
    });
});
/**
 * @desc    Get messages for a specific channel
 * @route   GET /api/chat/channels/:channelId/messages
 * @access  Private (channel members only)
 */
const getChannelMessages = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const { page, limit } = req.query;
    const userId = req.user.id;
    const result = await chatService.getChannelMessages(channelId, userId, {
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
    });
    res.status(200).json({
        success: true,
        data: result.messages,
        channel: result.channel,
        pagination: result.pagination,
    });
});
/**
 * @desc    Send a message to a specific channel
 * @route   POST /api/workspaces/:workspaceId/chat
 * @access  Private (channel members only)
 */
const sendMessage = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { channelId, content, mentions } = req.body;
    const senderId = req.user.id;
    const message = await chatService.createMessage({
        workspaceId,
        channelId,
        senderId,
        content,
        mentions,
    });
    // Include message usage in response
    const response = {
        success: true,
        data: message,
    };
    if (req.messageUsage) {
        response.messageUsage = req.messageUsage;
    }
    res.status(201).json(response);
});
/**
 * @desc    Delete a chat message
 * @route   DELETE /api/chat/:id
 * @access  Private (sender or Admin/Owner)
 */
const deleteMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await chatService.deleteMessage(id, userId);
    res.status(200).json({
        success: true,
        message: result.message,
    });
});
/**
 * @desc    Get unread message count for a channel
 * @route   GET /api/chat/channels/:channelId/unread
 * @access  Private (channel members only)
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    const count = await chatService.getUnreadCount(channelId, userId);
    res.status(200).json({
        success: true,
        data: { unreadCount: count },
    });
});
/**
 * @desc    Update channel details
 * @route   PUT /api/workspaces/:workspaceId/chat/channels/:channelId
 * @access  Private (Admin/Owner only)
 */
const updateChannel = asyncHandler(async (req, res) => {
    const { workspaceId, channelId } = req.params;
    const userId = req.user.id;
    const channel = await chatService.updateChannel(workspaceId, channelId, userId, req.body);
    res.status(200).json({
        success: true,
        data: channel,
    });
});
/**
 * @desc    Get aggregate unread count for all accessible channels in a workspace
 * @route   GET /api/workspaces/:workspaceId/chat/unread
 * @access  Private
 */
/**
 * @desc    Get workspace-wide messages (usually from General channel)
 * @route   GET /api/workspaces/:workspaceId/chat
 * @access  Private
 */
const getWorkspaceMessages = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { page, limit } = req.query;
    const userId = req.user.id;
    const result = await chatService.getChannelMessages('general', userId, {
        workspaceId,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
    });
    res.status(200).json({
        success: true,
        data: result.messages,
        channel: result.channel,
        pagination: result.pagination,
    });
});
const getWorkspaceUnreadCount = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.id;
    // For now, this is a placeholder or simplified logic
    // Real implementation would involve tracking lastRead for each channel per user
    res.status(200).json({
        success: true,
        data: { unreadCount: 0 }
    });
});
module.exports = {
    createChannel,
    getChannels,
    getChannelMessages,
    sendMessage,
    deleteMessage,
    getUnreadCount,
    updateChannel,
    getWorkspaceUnreadCount,
    getWorkspaceMessages,
};
