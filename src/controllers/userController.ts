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

export const deleteMyAccount = asyncHandler(async (req: any, res: any) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.deletedAt = new Date();
  user.deletedReason = req.body?.reason || "User requested account deletion";
  user.password = "";
  user.googleId = undefined;
  user.githubUsername = undefined;
  user.appleId = undefined;
  user.profilePicture = undefined;
  user.coverPhoto = undefined;
  user.notificationPreferences = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Account deleted successfully"
  });
});

/**
 * Get specific user profile
 * GET /api/users/:userId
 */
export const getUserProfile = asyncHandler(async (req: any, res: any) => {
  const { userId } = req.params;
  const { workspaceId } = req.query;
  const user = await User.findById(userId).select("-password").lean();
  
  if (!user) {
    throw new AppError("User not found", 404);
  }

  let workspaceData = null;
  if (workspaceId) {
    const Workspace = require("../models/Workspace");
    const workspace = await Workspace.findById(workspaceId)
      .populate("members.customRole")
      .lean();
    
    if (workspace) {
      const member = workspace.members.find((m: any) => 
        (m.user._id || m.user).toString() === userId
      );
      if (member) {
        workspaceData = {
          role: member.role,
          customRole: member.customRole,
          customRoleTitle: member.customRoleTitle
        };
      }
    }
  }

  res.json({
    success: true,
    data: {
      ...user,
      workspaceData
    }
  });
});

/**
 * Update current user profile
 * PATCH /api/users/profile
 */
export const updateProfile = asyncHandler(async (req: any, res: any) => {
  const { name, jobTitle, department, bio, githubUsername, removeAvatar, removeCoverPhoto } = req.body;
  const userId = req.user.id;
  const files = req.files;

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
  if (files && files['file'] && files['file'][0]) {
    const result = await uploadService.uploadProfilePicture(files['file'][0], userId);
    user.profilePicture = result.url;
  } else if (removeAvatar === 'true') {
    user.profilePicture = undefined;
  }

  // Handle cover photo
  if (files && files['coverPhoto'] && files['coverPhoto'][0]) {
    // Assuming uploadProfilePicture can handle cover photos too or similar logic
    const result = await uploadService.uploadProfilePicture(files['coverPhoto'][0], userId);
    user.coverPhoto = result.url;
  } else if (removeCoverPhoto === 'true') {
    user.coverPhoto = undefined;
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
      coverPhoto: user.coverPhoto,
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
  const workspaceId = req.body?.workspaceId || req.query?.workspaceId;

  const EntitlementService = require("../services/entitlementService").default;
  if (workspaceId) {
    const workspaceEntitlement = await EntitlementService.canUseFeatureInWorkspace(
      workspaceId,
      "canUseNotificationPreferences",
      "Notification preferences are not available in this workspace plan."
    );
    if (!workspaceEntitlement.allowed) {
      throw new AppError(workspaceEntitlement.reason || "Notification preferences are not available.", 403);
    }
  } else {
    const personalEntitlement = await EntitlementService.canUseNotificationPreferences(userId);
    if (!personalEntitlement.allowed) {
      throw new AppError(personalEntitlement.reason || "Notification preferences are not available.", 403);
    }
  }

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
