"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
let firebaseApp = null;
/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = () => {
    // Check if already initialized
    if (admin.apps.length > 0) {
        console.log("[Firebase] Admin SDK already initialized, reusing existing app");
        return admin.apps[0];
    }
    if (firebaseApp) {
        return firebaseApp;
    }
    try {
        // Check if service account is provided
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccount) {
            console.warn("[Firebase] FIREBASE_SERVICE_ACCOUNT not configured. Push notifications disabled.");
            // Return a mock app that won't crash the server
            return null;
        }
        // Parse service account JSON
        const serviceAccountObj = JSON.parse(serviceAccount);
        // Initialize Firebase Admin
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountObj),
        });
        console.log("[Firebase] Admin SDK initialized successfully");
        return firebaseApp;
    }
    catch (error) {
        console.error("[Firebase] Failed to initialize:", error);
        console.warn("[Firebase] Push notifications will be disabled");
        return null;
    }
};
/**
 * Get Firebase Messaging instance
 */
const getMessaging = () => {
    try {
        const app = initializeFirebase();
        if (!app) {
            return null;
        }
        return admin.messaging(app);
    }
    catch (error) {
        console.error("[Firebase] Failed to get messaging instance:", error);
        return null;
    }
};
/**
 * Check if Firebase is configured
 */
const isFirebaseConfigured = () => {
    return !!process.env.FIREBASE_SERVICE_ACCOUNT;
};
module.exports = {
    initializeFirebase,
    getMessaging,
    isFirebaseConfigured,
};
