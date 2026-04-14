const notificationService = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * @desc    Get user notifications with pagination
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const unreadOnly = req.query.unreadOnly === "true";

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
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req: any, res: any) => {
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
const markAllAsRead = asyncHandler(async (req: any, res: any) => {
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
const getUnreadCount = asyncHandler(async (req: any, res: any) => {
  const userId = req.user.id;

  const unreadCount = await notificationService.getUnreadCount(userId);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
});

/**
 * @desc    Create a notification manually
 * @route   POST /api/notifications
 * @access  Private
 */
const createNotification = asyncHandler(async (req: any, res: any) => {
  const { recipientId, type, title, message, link, data = {} } = req.body;

  if (!recipientId || !type || !title || !message) {
    throw new AppError("Recipient ID, type, title, and message are required", 400);
  }

  // Map frontend field 'message' to backend 'body'
  const notificationCount = await notificationService.createNotification({
    recipientId,
    type: type.toUpperCase(),
    title,
    body: message,
    data: {
      ...data,
      link
    }
  });

  res.status(201).json({
    success: true,
    data: notificationCount,
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification
};

export {};
