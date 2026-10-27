import apiReadCacheService from "../services/apiReadCacheService";

const CACHE_AFFECTING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CACHE_AFFECTING_PATH = /^\/api\/(?:workspaces|spaces|folders|lists|tasks)(?:\/|$)/;

export const readCacheInvalidationMiddleware = (req: any, res: any, next: any) => {
  const shouldInvalidate = CACHE_AFFECTING_METHODS.has(req.method) &&
    CACHE_AFFECTING_PATH.test(req.path || req.originalUrl?.split("?")[0] || "");

  if (shouldInvalidate) {
    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void apiReadCacheService.invalidateAll().catch((error: unknown) => {
          console.error("[ReadCache] Failed to invalidate cached reads:", error);
        });
      }
    });
  }

  next();
};

export {};
