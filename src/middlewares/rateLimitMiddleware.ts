import rateLimit from "express-rate-limit";

/**
 * Intruder Protection Limiter
 * Aggressive IP-based limiting to block brute-force and rapid bursts from a single source.
 */
export const intruderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
 * Uses the userId from the authenticated request.
 */
export const userRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: (req: any) => {
    // Admins and Owners get higher throughput (e.g., 500 req/min)
    const role = req.user?.role;
    if (role === "admin" || role === "owner") return 500;
    return 200; // Standard users: 200 req/min
  },
  keyGenerator: (req: any) => {
    // If user is authenticated, use their ID. Otherwise fallback to IP.
    return req.user?.id || req.ip;
  },
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
 * Specialized aggressive limiting for sensitive auth endpoints.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Only 15 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    error: "AUTH_RATE_LIMIT_EXCEEDED"
  }
});
