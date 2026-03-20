"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const generateToken = require("../utils/generateToken");
const admin = require("firebase-admin");
const User_1 = __importDefault(require("../models/User"));
const emailService = require("../services/emailService");
// Don't initialize here - use the existing initialization from config/firebase.ts
// Firebase Admin is already initialized in server.ts
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Please provide all fields" });
        }
        // Check for existing user
        const userExists = await User_1.default.findOne({ email: email.toLowerCase() });
        if (userExists) {
            return res.status(400).json({
                message: "An account with this email already exists. Please login instead.",
                code: "EMAIL_EXISTS"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User_1.default.create({
            name,
            email: email.toLowerCase(), // Store email in lowercase
            password: hashedPassword
        });
        // STANDARDIZED RESPONSE - matches login format
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token: generateToken(user._id.toString(), user.email, user.name),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            }
        });
    }
    catch (error) {
        // Handle MongoDB duplicate key error
        if (error.code === 11000 && error.keyPattern?.email) {
            return res.status(400).json({
                message: "An account with this email already exists. Please login instead.",
                code: "EMAIL_EXISTS"
            });
        }
        res.status(500).json({
            message: "Server error",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Please provide email and password" });
        }
        const user = await User_1.default.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User does not exist. Please register first." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password. Please try again." });
        }
        // STANDARDIZED RESPONSE
        res.json({
            success: true,
            message: "Logged in successfully",
            token: generateToken(user._id.toString(), user.email, user.name),
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isSuperUser: user.isSuperUser || false
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : "Unknown error" });
    }
};
const googleAuth = async (req, res) => {
    try {
        console.log("[Google Auth] Request received");
        const { idToken } = req.body;
        if (!idToken) {
            console.error("[Google Auth] No ID token provided");
            return res.status(400).json({ message: "ID token is required" });
        }
        console.log("[Google Auth] ID token received, length:", idToken.length);
        // Check if Firebase Admin is initialized
        if (!admin.apps || admin.apps.length === 0) {
            console.error("[Google Auth] Firebase Admin not initialized");
            return res.status(500).json({
                message: "Firebase Admin SDK not configured. Please check FIREBASE_SERVICE_ACCOUNT in backend .env"
            });
        }
        // Verify the Firebase ID token
        let decodedToken;
        try {
            console.log("[Google Auth] Verifying ID token...");
            decodedToken = await admin.auth().verifyIdToken(idToken);
            console.log("[Google Auth] Token verified successfully");
            console.log("[Google Auth] User email:", decodedToken.email);
        }
        catch (error) {
            console.error("[Google Auth] Token verification error:", error.message);
            console.error("[Google Auth] Error code:", error.code);
            return res.status(401).json({
                message: "Invalid ID token",
                error: error.message
            });
        }
        const { email, name, picture, uid } = decodedToken;
        if (!email) {
            console.error("[Google Auth] No email in token");
            return res.status(400).json({ message: "Email not found in token" });
        }
        console.log("[Google Auth] Looking for user with email:", email);
        // Check if user exists (case-insensitive)
        let user = await User_1.default.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log("[Google Auth] User not found, creating new user");
            // Create new user with Google auth
            // Generate cryptographically random password (not used for login, but secure)
            const randomPassword = crypto.randomBytes(32).toString('hex');
            user = await User_1.default.create({
                name: name || email.split('@')[0],
                email: email.toLowerCase(),
                password: await bcrypt.hash(randomPassword, 10),
                profilePicture: picture || undefined,
                googleId: uid,
            });
            console.log("[Google Auth] New user created:", user._id);
        }
        else {
            console.log("[Google Auth] Existing user found:", user._id);
            console.log("[Google Auth] Linking Google account to existing user");
            // Always link/update Google account to existing user
            user.googleId = uid;
            // Update profile picture if user doesn't have one
            if (picture && !user.profilePicture) {
                user.profilePicture = picture;
            }
            // Only update name if user currently has no name or their name is just their email prefix
            // Do NOT overwrite if they've set a custom name in their profile
            if (name && (!user.name || user.name === user.email.split('@')[0])) {
                user.name = name;
            }
            await user.save();
            console.log("[Google Auth] Google account linked successfully");
        }
        console.log("[Google Auth] Generating JWT token");
        const token = generateToken(user._id.toString(), user.email, user.name);
        // STANDARDIZED RESPONSE
        console.log("[Google Auth] Sending success response");
        res.json({
            success: true,
            message: "Logged in with Google successfully",
            token: token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture,
                isSuperUser: user.isSuperUser || false
            }
        });
    }
    catch (error) {
        console.error("[Google Auth] Unexpected error:", error);
        console.error("[Google Auth] Error stack:", error.stack);
        res.status(500).json({
            message: "Server error during Google authentication",
            error: error.message
        });
    }
};
const requestPasswordReset = async (req, res) => {
    try {
        const rawEmail = String(req.body?.email || '').trim();
        const email = rawEmail.toLowerCase();
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        console.log(`[Auth] Password reset requested for: ${email}`);
        const user = await User_1.default.findOne({ email });
        // Always respond 200 to avoid account enumeration
        if (!user) {
            console.log(`[Auth] Password reset: no user found for ${email} (returning generic success)`);
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
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`;
        try {
            console.log(`[Auth] Sending password reset email to: ${user.email}`);
            await emailService.sendPasswordResetEmail({
                recipientEmail: user.email,
                recipientName: user.name,
                resetLink
            });
            console.log(`[Auth] Password reset email sent to: ${user.email}`);
        }
        catch (error) {
            console.error("[Auth] Failed to send password reset email:", error?.message || error);
            // In development, surface the failure so the UI doesn't claim "sent" when it wasn't.
            if (process.env.NODE_ENV !== "production") {
                return res.status(500).json({
                    message: "Failed to send reset email. Check SMTP credentials / Gmail app password and server logs."
                });
            }
            // In production, still return generic success to prevent enumeration.
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
    }
    catch (error) {
        console.error("[Auth] requestPasswordReset error:", error?.message || error);
        res.status(500).json({ message: "Server error" });
    }
};
const resetPassword = async (req, res) => {
    try {
        const token = String(req.body?.token || '').trim();
        const newPassword = String(req.body?.password || '').trim();
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and password are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User_1.default.findOne({
            passwordResetToken: tokenHash,
            passwordResetTokenExpires: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        await user.save();
        res.json({ success: true, message: "Password reset successfully" });
    }
    catch (error) {
        console.error("[Auth] resetPassword error:", error?.message || error);
        res.status(500).json({ message: "Server error" });
    }
};
module.exports = { registerUser, loginUser, googleAuth, requestPasswordReset, resetPassword };
