const xss = require("xss");

const sanitizeString = (value: string) => {
  if (typeof value !== "string") return value;
  
  // 1. Strip HTML tags (XSS Protection)
  const cleanXss = xss(value);
  
  // 2. Remove NoSQL Injection patterns ($ and .)
  const cleanNoSql = cleanXss.replace(/\$|\./g, "");
  
  return cleanNoSql;
};

const sanitizeObject = (obj: any) => {
  if (obj === null || typeof obj !== "object") {
    if (typeof obj === "string") return sanitizeString(obj);
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((v) => sanitizeObject(v));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Sanitize the key itself to prevent NoSQL injection via key names
      const sanitizedKey = key.replace(/\$|\./g, "");
      sanitized[sanitizedKey] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
};

const sanitizeMiddleware = (req: any, res: any, next: any) => {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    next();
  } catch (error) {
    console.error('[Security] Error in sanitization middleware:', error);
    next();
  }
};

module.exports = sanitizeMiddleware;
