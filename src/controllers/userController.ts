import User from "../models/User";
const uploadService = require("../services/uploadService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Get current user profile
 * GET /api/users/profile
 */
export const getMyProfile = asyncHandler(async (req: any, res: any) => {
  const user = await User.findById(req.user.id).select("-password");
  
  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.json({
    success: true,
    data: user
  });
});

/**
 * Update current user profile
 * PATCH /api/users/profile
 */
export const updateProfile = asyncHandler(async (req: any, res: any) => {
  const { name, jobTitle, department, bio, githubUsername, removeAvatar } = req.body;
  const userId = req.user.id;
  const file = req.file;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Update basic fields
  if (name) user.name = name;
  if (jobTitle !== undefined) (user as any).jobTitle = jobTitle;
  if (department !== undefined) (user as any).department = department;
  if (bio !== undefined) (user as any).bio = bio;
  if (githubUsername !== undefined) (user as any).githubUsername = githubUsername;

  // Handle avatar
  if (file) {
    // Re-use existing upload logic if possible, or direct Cloudinary upload
    // For now, let's assume we use a similar pattern as uploadService
    const result = await uploadService.uploadProfilePicture(file, userId);
    user.profilePicture = result.url;
  } else if (removeAvatar === 'true') {
    user.profilePicture = undefined;
  }

  await user.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      jobTitle: (user as any).jobTitle,
      department: (user as any).department,
      bio: (user as any).bio,
      notificationPreferences: (user as any).notificationPreferences
    }
  });
});

/**
 * Update user notification preferences
 * PATCH /api/users/notification-preferences
 */
export const updateNotificationPreferences = asyncHandler(async (req: any, res: any) => {
  const { 
    githubCommits, 
    taskAssigned, 
    taskStatusChange,
    taskUpdates,
    messages,
    groupChats,
    mentions, 
    comments,
    notices,
    mutedChannels,
    mutedUsers
  } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.notificationPreferences) {
    (user as any).notificationPreferences = {
      githubCommits: true,
      taskAssigned: true,
      taskStatusChange: true,
      taskUpdates: true,
      messages: true,
      groupChats: true,
      mentions: true,
      comments: true,
      notices: true,
      mutedChannels: [],
      mutedUsers: []
    };
  }

  const prefs = (user as any).notificationPreferences;
  if (githubCommits !== undefined) prefs.githubCommits = githubCommits;
  if (taskAssigned !== undefined) prefs.taskAssigned = taskAssigned;
  if (taskStatusChange !== undefined) prefs.taskStatusChange = taskStatusChange;
  if (taskUpdates !== undefined) prefs.taskUpdates = taskUpdates;
  if (messages !== undefined) prefs.messages = messages;
  if (groupChats !== undefined) prefs.groupChats = groupChats;
  if (mentions !== undefined) prefs.mentions = mentions;
  if (comments !== undefined) prefs.comments = comments;
  if (notices !== undefined) prefs.notices = notices;
  if (mutedChannels !== undefined) prefs.mutedChannels = mutedChannels;
  if (mutedUsers !== undefined) prefs.mutedUsers = mutedUsers;

  user.markModified('notificationPreferences');
  await user.save();

  res.json({
    success: true,
    message: "Notification preferences updated",
    data: user.notificationPreferences
  });
});
