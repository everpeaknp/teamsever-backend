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
  const { name, jobTitle, department, bio, removeAvatar } = req.body;
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
      bio: (user as any).bio
    }
  });
});
