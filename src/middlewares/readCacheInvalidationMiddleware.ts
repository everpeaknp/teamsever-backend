import apiReadCacheService from "../services/apiReadCacheService";

const CACHE_AFFECTING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CACHE_AFFECTING_PATH = /^\/api\/(?:workspaces|spaces|folders|lists|tasks)(?:\/|$)/;
const WORKSPACE_CHAT_PATH = /^\/api\/workspaces\/[^/]+\/chat(?:\/|$)/;
const CHAT_CHANNEL_CONFIG_PATH = /^\/api\/workspaces\/[^/]+\/chat\/channels(?:\/[^/]+)?\/?$/;

export const readCacheInvalidationMiddleware = (req: any, res: any, next: any) => {
  const path = req.path || req.originalUrl?.split("?")[0] || "";
  const isWrite = CACHE_AFFECTING_METHODS.has(req.method);
  // Message/read-receipt writes invalidate from their service before socket
  // broadcasts; channel CRUD has no such message service path.
  const isChatChannelConfigWrite = isWrite && CHAT_CHANNEL_CONFIG_PATH.test(path);
  const shouldInvalidateShared = isWrite && !WORKSPACE_CHAT_PATH.test(path) && CACHE_AFFECTING_PATH.test(path);

  if (isChatChannelConfigWrite || shouldInvalidateShared) {
    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const invalidation = isChatChannelConfigWrite
          ? apiReadCacheService.invalidateNamespace("chat-channels")
          : apiReadCacheService.invalidateAll();
        void invalidation.catch((error: unknown) => {
          console.error("[ReadCache] Failed to invalidate cached reads:", error);
        });
      }
    });
  }

  next();
};

export {};
