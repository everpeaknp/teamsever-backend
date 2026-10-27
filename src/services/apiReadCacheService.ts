import redis from "../config/redis";

type RedisCacheClient = {
  status?: string;
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  mget?(...keys: string[]): Promise<Array<string | null>>;
  on?: (event: string, listener: () => void) => unknown;
};

type MemoryEntry = { value: unknown; expiresAt: number };

const GENERATION_KEY = "api-read-cache:generation";
const NAMESPACE_GENERATION_PREFIX = `${GENERATION_KEY}:`;
const KEY_PREFIX = "api-read:v1";
const MAX_MEMORY_ENTRIES = 250;

class ApiReadCacheService {
  private readonly memoryCache = new Map<string, MemoryEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private localGeneration = 0;
  private readonly localNamespaceGenerations = new Map<string, number>();

  constructor(
    private readonly redisClient: RedisCacheClient = redis as RedisCacheClient,
    private readonly now: () => number = Date.now,
  ) {
    this.redisClient.on?.("ready", () => {
      void this.redisClient.incr(GENERATION_KEY).catch(() => undefined);
    });
  }

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    namespace = "shared",
  ): Promise<T> {
    const generation = await this.currentGeneration(namespace);
    const fullKey = `${KEY_PREFIX}:${encodeURIComponent(namespace)}:${generation}:${encodeURIComponent(key)}`;

    if (this.redisClient.status === "ready") {
      try {
        const raw = await this.redisClient.get(fullKey);
        if (raw !== null) return JSON.parse(raw) as T;
      } catch (_error) {
        // Fall through to the bounded in-process cache and database loader.
      }
    }

    const local = this.memoryCache.get(fullKey);
    if (local) {
      if (local.expiresAt > this.now()) return local.value as T;
      this.memoryCache.delete(fullKey);
    }

    const pending = this.inFlight.get(fullKey);
    if (pending) return pending as Promise<T>;

    const load = loader()
      .then(async (value) => {
        const serialized = JSON.stringify(value);
        this.remember(fullKey, value, ttlSeconds);
        if (this.redisClient.status === "ready" && serialized !== undefined) {
          try {
            await this.redisClient.setex(fullKey, ttlSeconds, serialized);
          } catch (_error) {
            // MongoDB remains authoritative; keep the local fallback only.
          }
        }
        return value;
      })
      .finally(() => this.inFlight.delete(fullKey));

    this.inFlight.set(fullKey, load);
    return load;
  }

  async invalidateAll(): Promise<void> {
    this.localGeneration += 1;
    this.memoryCache.clear();

    if (this.redisClient.status === "ready") {
      try {
        await this.redisClient.incr(GENERATION_KEY);
      } catch (_error) {
        // The local generation still invalidates this process's fallback.
      }
    }
  }

  async invalidateNamespace(namespace: string): Promise<void> {
    const localGeneration = (this.localNamespaceGenerations.get(namespace) ?? 0) + 1;
    this.localNamespaceGenerations.set(namespace, localGeneration);
    const localPrefix = `${KEY_PREFIX}:${encodeURIComponent(namespace)}:`;
    for (const cachedKey of this.memoryCache.keys()) {
      if (cachedKey.startsWith(localPrefix)) this.memoryCache.delete(cachedKey);
    }

    if (this.redisClient.status === "ready") {
      try {
        await this.redisClient.incr(`${NAMESPACE_GENERATION_PREFIX}${encodeURIComponent(namespace)}`);
      } catch (_error) {
        // The process-local generation still invalidates this process's fallback.
      }
    }
  }

  private async currentGeneration(namespace: string): Promise<string> {
    if (this.redisClient.status === "ready") {
      try {
        const namespaceKey = `${NAMESPACE_GENERATION_PREFIX}${encodeURIComponent(namespace)}`;
        const versions = this.redisClient.mget
          ? await this.redisClient.mget(GENERATION_KEY, namespaceKey)
          : [await this.redisClient.get(GENERATION_KEY), await this.redisClient.get(namespaceKey)];
        return `${versions[0] ?? "0"}-${versions[1] ?? "0"}`;
      } catch (_error) {
        // Continue with the process-local generation while Redis is unavailable.
      }
    }
    return `${this.localGeneration}-local-${this.localNamespaceGenerations.get(namespace) ?? 0}`;
  }

  private remember(key: string, value: unknown, ttlSeconds: number): void {
    const now = this.now();
    for (const [cachedKey, entry] of this.memoryCache) {
      if (entry.expiresAt <= now) this.memoryCache.delete(cachedKey);
    }
    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey !== undefined) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  }
}

export { ApiReadCacheService };
export default new ApiReadCacheService();
