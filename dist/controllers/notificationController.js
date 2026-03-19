"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");
/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await notificationService.getUserNotifications(userId, {
        page,
        limit,
        unreadOnly,
    });
    res.status(200).json({
        success: true,
        data: result.notifications,
        pagination: result.pagination,
    });
});
/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);
    res.status(200).json({
        success: true,
        data: { count },
    });
});
/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.id;
    const notification = await notificationService.markAsRead(notificationId, userId);
    res.status(200).json({
        success: true,
        data: notification,
    });
});
/**
 * @desc    Mark all notifications as read
 * @route   POST /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);
    res.status(200).json({
        success: true,
        message: `Marked ${count} notifications as read`,
        data: { count },
    });
});
/**
 * @desc    Register device token for push notifications
 * @route   POST /api/notifications/register-device
 * @access  Private
 */
const registerDevice = asyncHandler(async (req, res) => {
    const { token, platform } = req.body;
    const userId = req.user.id;
    await notificationService.registerDeviceToken(userId, token, platform);
    res.status(200).json({
        success: true,
        message: "Device registered successfully",
    });
});
/**
 * @desc    Unregister device token
 * @route   DELETE /api/notifications/unregister-device
 * @access  Private
 */
const unregisterDevice = asyncHandler(async (req, res) => {
    const { token } = req.body;
    await notificationService.unregisterDeviceToken(token);
    res.status(200).json({
        success: true,
        message: "Device unregistered successfully",
    });
});
/**
 * @desc    Get user's registered devices
 * @route   GET /api/notifications/devices
 * @access  Private
 */
const getDevices = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const devices = await notificationService.getUserDevices(userId);
    res.status(200).json({
        success: true,
        data: devices,
    });
});
/**
 * @desc    Register FCM token for web push notifications
 * @route   POST /api/notifications/fcm-token
 * @access  Private
 */
const registerFCMToken = asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.id;
    if (!fcmToken) {
        return res.status(400).json({
            success: false,
            message: "FCM token is required",
        });
    }
    await notificationService.registerDeviceToken(userId, fcmToken, 'web');
    res.status(200).json({
        success: true,
        message: "FCM token registered successfully",
    });
});
module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    registerDevice,
    unregisterDevice,
    getDevices,
    registerFCMToken,
};
