"use strict";
/**
 * NoSQL Injection Protection Middleware
 * Compatible with Express v5
 *
 * Sanitizes req.body, req.query, and req.params by removing MongoDB operators
 * like $ne, $gt, $where, etc.
 *
 * Note: In Express v5, req.query and req.params are read-only getters,
 * so we validate and block requests with dangerous operators instead of modifying them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hasDangerousKeys = (obj, path = '') => {
    if (obj === null || obj === undefined) {
        return null;
    }
    // Handle arrays
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const result = hasDangerousKeys(obj[i], `${path}[${i}]`);
            if (result)
                return result;
        }
        return null;
    }
    // Handle objects
    if (typeof obj === 'object') {
        for (const key in obj) {
            // Use Object.prototype.hasOwnProperty.call for compatibility
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Check if key starts with $ or contains .
                if (key.startsWith('$') || key.includes('.')) {
                    return `${path}.${key}`;
                }
                // Recursively check nested objects
                const result = hasDangerousKeys(obj[key], `${path}.${key}`);
                if (result)
                    return result;
            }
        }
    }
    return null;
};
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) {
        return obj;
    }
    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    // Handle objects
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            // Use Object.prototype.hasOwnProperty.call for compatibility
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Skip keys that start with $ or contain .
                if (key.startsWith('$') || key.includes('.')) {
                    continue;
                }
                // Recursively sanitize nested objects
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    // Return primitive values as-is
    return obj;
};
const sanitizeMiddleware = (req, res, next) => {
    try {
        // Check query parameters for dangerous keys (read-only in Express v5)
        if (req.query && typeof req.query === 'object') {
            const dangerousKey = hasDangerousKeys(req.query, 'query');
            if (dangerousKey) {
                console.warn(`[Security] Blocked NoSQL injection attempt in query: ${dangerousKey}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid query parameters detected',
                    error: 'Query parameters cannot contain MongoDB operators ($ or .)'
                });
            }
        }
        // Check URL parameters for dangerous keys (read-only in Express v5)
        if (req.params && typeof req.params === 'object') {
            const dangerousKey = hasDangerousKeys(req.params, 'params');
            if (dangerousKey) {
                console.warn(`[Security] Blocked NoSQL injection attempt in params: ${dangerousKey}`);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid URL parameters detected',
                    error: 'URL parameters cannot contain MongoDB operators ($ or .)'
                });
            }
        }
        // Sanitize request body (this is writable)
        if (req.body && typeof req.body === 'object') {
            const dangerousKey = hasDangerousKeys(req.body, 'body');
            if (dangerousKey) {
                console.warn(`[Security] Sanitizing NoSQL injection attempt in body: ${dangerousKey}`);
                req.body = sanitizeObject(req.body);
            }
        }
        next();
    }
    catch (error) {
        console.error('[Security] Error in sanitization middleware:', error);
        next(error);
    }
};
module.exports = sanitizeMiddleware;
