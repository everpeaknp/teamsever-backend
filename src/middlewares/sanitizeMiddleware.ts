const xss = require("xss");

const sanitizeString = (value: string) => {
  if (typeof value !== "string") return value;
  
  // Strip HTML tags only. Do NOT strip "." from values because it corrupts
  // JWTs, emails, URLs, filenames, etc.
  return xss(value);
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
