import redis from "../config/redis";

type CacheEntry = {
  value: any;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_SECONDS = 45;
const KEY_PREFIX = "analytics:v2:dashboard";

class AnalyticsV2CacheService {
  buildSummaryKey(params: {
    workspaceId: string;
    userId: string;
    view?: string;
    from?: string;
    to?: string;
  }): string {
    const view = params.view || "";
    const from = params.from || "";
    const to = params.to || "";
    return `${KEY_PREFIX}:${params.workspaceId}:${params.userId}:${view}:${from}:${to}`;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (redis?.status === "ready") {
      try {
        const raw = await redis.get(key);
        if (raw) return JSON.parse(raw) as T;
      } catch (_error) {
        // fallback to memory
      }
    }

    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    if (redis?.status === "ready") {
      try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch (_error) {
        // fallback to memory
      }
    }

    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async invalidateWorkspace(workspaceId: string): Promise<void> {
    if (!workspaceId) return;
    const redisPattern = `${KEY_PREFIX}:${workspaceId}:*`;

    if (redis?.status === "ready") {
      try {
        const keys = await redis.keys(redisPattern);
        if (keys.length > 0) await redis.del(...keys);
      } catch (_error) {
        // continue to memory fallback
      }
    }

    for (const key of memoryCache.keys()) {
      if (key.startsWith(`${KEY_PREFIX}:${workspaceId}:`)) {
        memoryCache.delete(key);
      }
    }
  }
}

module.exports = new AnalyticsV2CacheService();
export {};
