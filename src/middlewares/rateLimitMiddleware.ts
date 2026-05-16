import rateLimit from "express-rate-limit";

/**
 * Intruder Protection Limiter
 * Aggressive IP-based limiting to block brute-force and rapid bursts from a single source.
 */
export const intruderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Increased to 1000 for SPA compatibility
  standardHeaders: true, 
  legacyHeaders: false, 
  skip: (req) => req.method === "OPTIONS",
  message: {
    success: false,
    message: "Too many requests from this IP. Please wait a minute before trying again.",
    error: "RATE_LIMIT_EXCEEDED"
  }
});

/**
 * User Activity Limiter
 * Per-user limiting to prevent spamming actions like chat messages, task creation, etc.
 */
export const userRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: (req: any) => {
    const role = req.user?.role;
    if (role === "admin" || role === "owner") return 3000;
    return 1500; 
  },
  keyGenerator: (req: any) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: {
    success: false,
    message: "You are performing actions too quickly. Please slow down.",
    error: "USER_RATE_LIMIT_EXCEEDED"
  }
});

/**
 * Auth Protection Limiter
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 15, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    error: "AUTH_RATE_LIMIT_EXCEEDED"
  }
});
