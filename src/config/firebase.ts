import * as admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 */
const initializeFirebase = (): admin.app.App => {
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
      return null as any;
    }

    // Parse service account JSON
    const serviceAccountObj = JSON.parse(serviceAccount);

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountObj),
    });

    console.log("[Firebase] Admin SDK initialized successfully");
    return firebaseApp;
  } catch (error) {
    console.error("[Firebase] Failed to initialize:", error);
    console.warn("[Firebase] Push notifications will be disabled");
    return null as any;
  }
};

/**
 * Get Firebase Messaging instance
 */
const getMessaging = (): admin.messaging.Messaging | null => {
  try {
    const app = initializeFirebase();
    if (!app) {
      return null;
    }
    return admin.messaging(app);
  } catch (error) {
    console.error("[Firebase] Failed to get messaging instance:", error);
    return null;
  }
};

/**
 * Check if Firebase is configured
 */
const isFirebaseConfigured = (): boolean => {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
};

module.exports = {
  initializeFirebase,
  getMessaging,
  isFirebaseConfigured,
};
export {};
