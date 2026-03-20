"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getMyProfile = void 0;
const User_1 = __importDefault(require("../models/User"));
const uploadService = require("../services/uploadService");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
/**
 * Get current user profile
 * GET /api/users/profile
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
    const user = await User_1.default.findById(req.user.id).select("-password");
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
exports.updateProfile = asyncHandler(async (req, res) => {
    const { name, jobTitle, department, bio, removeAvatar } = req.body;
    const userId = req.user.id;
    const file = req.file;
    const user = await User_1.default.findById(userId);
    if (!user) {
        throw new AppError("User not found", 404);
    }
    // Update basic fields
    if (name)
        user.name = name;
    if (jobTitle !== undefined)
        user.jobTitle = jobTitle;
    if (department !== undefined)
        user.department = department;
    if (bio !== undefined)
        user.bio = bio;
    // Handle avatar
    if (file) {
        // Re-use existing upload logic if possible, or direct Cloudinary upload
        // For now, let's assume we use a similar pattern as uploadService
        const result = await uploadService.uploadProfilePicture(file, userId);
        user.profilePicture = result.url;
    }
    else if (removeAvatar === 'true') {
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
            jobTitle: user.jobTitle,
            department: user.department,
            bio: user.bio
        }
    });
});
