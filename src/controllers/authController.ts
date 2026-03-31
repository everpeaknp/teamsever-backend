const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const admin = require("firebase-admin");
const User = require("../models/User");
const emailService = require("../services/emailService");

// Don't initialize here - use the existing initialization from config/firebase.ts
// Firebase Admin is already initialized in server.ts

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const registerUser = asyncHandler(async (req: any, res: any) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Please provide all fields", 400);
  }

  // Check for existing user
  const userExists = await User.findOne({ email: email.toLowerCase() });

  if (userExists) {
    throw new AppError("An account with this email already exists. Please login instead.", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: email.toLowerCase(), // Store email in lowercase
    password: hashedPassword
  });

  // STANDARDIZED RESPONSE - matches login format
  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      token: generateToken(user._id.toString(), user.email, user.name),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    }
  });
});

const loginUser = asyncHandler(async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Please provide email and password", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw new AppError("User does not exist. Please register first.", 404);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Incorrect password. Please try again.", 401);
  }

  // STANDARDIZED RESPONSE
  res.json({
    success: true,
    message: "Logged in successfully",
    data: {
      token: generateToken(user._id.toString(), user.email, user.name),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isSuperUser: user.isSuperUser || false
      }
    }
  });
});

const googleAuth = asyncHandler(async (req: any, res: any) => {
  console.log("[Google Auth] Request received");
  const { idToken } = req.body;

  if (!idToken) {
    throw new AppError("ID token is required", 400);
  }

  // Check if Firebase Admin is initialized
  if (!admin.apps || admin.apps.length === 0) {
    throw new AppError("Firebase Admin SDK not configured. Please check FIREBASE_SERVICE_ACCOUNT in backend .env", 500);
  }

  // Verify the Firebase ID token
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error: any) {
    throw new AppError(`Invalid ID token: ${error.message}`, 401);
  }

  const { email, name, picture, uid } = decodedToken;

  if (!email) {
    throw new AppError("Email not found in token", 400);
  }

  // Check if user exists (case-insensitive)
  let user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Create new user with Google auth
    const randomPassword = crypto.randomBytes(32).toString('hex');
    user = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: await bcrypt.hash(randomPassword, 10),
      profilePicture: picture || undefined,
      googleId: uid,
    });
  } else {
    // Always link/update Google account to existing user
    user.googleId = uid;
    
    // Update profile picture if user doesn't have one
    if (picture && !user.profilePicture) {
      user.profilePicture = picture;
    }
    
    // Only update name if user currently has no name or their name is just their email prefix
    if (name && (!user.name || user.name === user.email.split('@')[0])) {
      user.name = name;
    }
    
    await user.save();
  }

  const token = generateToken(user._id.toString(), user.email, user.name);

  res.json({
    success: true,
    message: "Logged in with Google successfully",
    data: {
      token: token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        isSuperUser: user.isSuperUser || false
      }
    }
  });
});

const requestPasswordReset = asyncHandler(async (req: any, res: any) => {
  const rawEmail = String(req.body?.email || '').trim();
  const email = rawEmail.toLowerCase();

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ email });

  // Always respond 200 to avoid account enumeration
  if (!user) {
    return res.json({
      success: true,
      message: "If an account exists for this email, a reset link has been sent."
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = resetTokenHash;
  user.passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || "https://teamsever.vercel.app";
  const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

  try {
    await emailService.sendPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      resetLink
    });
  } catch (error: any) {
    console.error("[Auth] Failed to send password reset email:", error?.message || error);
    // In development, surface the failure
    if (process.env.NODE_ENV !== "production") {
      throw new AppError(`Failed to send reset email: ${error.message}`, 500);
    }
    // In production, generic success
    return res.json({
      success: true,
      message: "If an account exists for this email, a reset link has been sent."
    });
  }

  res.json({
    success: true,
    message: "If an account exists for this email, a reset link has been sent.",
    ...(process.env.NODE_ENV !== "production" ? { debug: { resetLink } } : {})
  });
});

const resetPassword = asyncHandler(async (req: any, res: any) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.password || '').trim();

  if (!token || !newPassword) {
    throw new AppError("Token and password are required", 400);
  }

  if (newPassword.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();

  res.json({ success: true, message: "Password reset successfully" });
});

module.exports = { registerUser, loginUser, googleAuth, requestPasswordReset, resetPassword };
export {};
