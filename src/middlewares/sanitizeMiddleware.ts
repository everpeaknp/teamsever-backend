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

const xss = require("xss");

// Configure XSS to be strict but allow nothing by default (can be customized)
const xssOptions = {
  whiteList: {}, // Empty whitelist means all HTML tags are stripped
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script"] // Specifically strip script bodies
};

const hasDangerousKeys = (obj: any, path: string = ''): string | null => {
  if (obj === null || obj === undefined) {
    return null;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = hasDangerousKeys(obj[i], `${path}[${i}]`);
      if (result) return result;
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
        if (result) return result;
      }
    }
  }

  return null;
};

const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings - THIS IS WHERE XSS PROTECTION HAPPENS
  if (typeof obj === 'string') {
    return xss(obj, xssOptions);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const key in obj) {
      // Use Object.prototype.hasOwnProperty.call for compatibility
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Skip keys that start with $ or contain . (NoSQL Injection)
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

const sanitizeMiddleware = (req: any, res: any, next: any) => {
  try {
    // 1. Check query parameters for dangerous keys (read-only in Express v5)
    if (req.query && typeof req.query === 'object') {
      const dangerousKey = hasDangerousKeys(req.query, 'query');
      if (dangerousKey) {
        console.warn(`[Security] Blocked NoSQL injection attempt in query: ${dangerousKey}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters detected',
          error: 'NOSQL_INJECTION_DETECTED'
        });
      }
    }

    // 2. Check URL parameters for dangerous keys (read-only in Express v5)
    if (req.params && typeof req.params === 'object') {
      const dangerousKey = hasDangerousKeys(req.params, 'params');
      if (dangerousKey) {
        console.warn(`[Security] Blocked NoSQL injection attempt in params: ${dangerousKey}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid URL parameters detected',
          error: 'NOSQL_INJECTION_DETECTED'
        });
      }
    }

    // 3. Sanitize request body (this is writable)
    // This now handles BOTH NoSQL Injection AND XSS
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    console.error('[Security] Error in sanitization middleware:', error);
    next(error);
  }
};

module.exports = sanitizeMiddleware;
export {};
