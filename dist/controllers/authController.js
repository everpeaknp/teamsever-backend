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
            // Update name if user's name is just email prefix and Google provides a better name
            if (name && user.name === user.email.split('@')[0]) {
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
                profilePicture: user.profilePicture
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
module.exports = { registerUser, loginUser, googleAuth };
