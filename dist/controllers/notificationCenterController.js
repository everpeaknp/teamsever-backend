"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
/**
 * @desc    Get user notifications with pagination
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = asyncHandler(async (req, res) => {
    console.log('[NotificationCenterController] getNotifications called', { query: req.query });
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === "true";
    const result = await notificationService.getUserNotifications(userId, {
        page,
        limit,
        unreadOnly,
    });
    console.log('[NotificationCenterController] Notifications retrieved', { count: result.notifications.length });
    res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
    });
});
/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    res.status(200).json({
        success: true,
        data: notification,
        message: "Notification marked as read",
    });
});
/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);
    res.status(200).json({
        success: true,
        data: { count },
        message: `${count} notifications marked as read`,
    });
});
/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const unreadCount = await notificationService.getUnreadCount(userId);
    res.status(200).json({
        success: true,
        data: { unreadCount },
    });
});
module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
};
