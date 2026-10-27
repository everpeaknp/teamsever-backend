import { ApiReadCacheService } from "../services/apiReadCacheService";

class FakeRedis {
  status = "ready";
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number>();

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async setex(key: string, ttl: number, value: string) {
    this.values.set(key, value);
    this.ttls.set(key, ttl);
    return "OK";
  }

  async incr(key: string) {
    const next = Number(this.values.get(key) ?? "0") + 1;
    this.values.set(key, String(next));
    return next;
  }
}

describe("ApiReadCacheService", () => {
  test("reuses a Redis value for the same user-scoped read key", async () => {
    const redis = new FakeRedis();
    const cache = new ApiReadCacheService(redis as any);
    const loader = jest.fn().mockResolvedValue({ spaces: ["space-1"] });

    const first = await cache.getOrLoad("hierarchy:workspace-1:user-1:admin", 30, loader);
    const second = await cache.getOrLoad("hierarchy:workspace-1:user-1:admin", 30, loader);

    expect(first).toEqual({ spaces: ["space-1"] });
    expect(second).toEqual(first);
    expect(loader).toHaveBeenCalledTimes(1);
    expect([...redis.ttls.values()]).toEqual([30]);
  });

  test("keeps different user keys isolated", async () => {
    const redis = new FakeRedis();
    const cache = new ApiReadCacheService(redis as any);
    const loadUserOne = jest.fn().mockResolvedValue({ spaces: ["visible-to-one"] });
    const loadUserTwo = jest.fn().mockResolvedValue({ spaces: ["visible-to-two"] });

    await cache.getOrLoad("hierarchy:workspace-1:user-1:member", 30, loadUserOne);
    const userTwo = await cache.getOrLoad("hierarchy:workspace-1:user-2:member", 30, loadUserTwo);

    expect(userTwo).toEqual({ spaces: ["visible-to-two"] });
    expect(loadUserTwo).toHaveBeenCalledTimes(1);
  });

  test("invalidating advances the shared generation and reloads data", async () => {
    const redis = new FakeRedis();
    const cache = new ApiReadCacheService(redis as any);
    const loader = jest.fn()
      .mockResolvedValueOnce({ listCount: 2 })
      .mockResolvedValueOnce({ listCount: 3 });

    await cache.getOrLoad("hierarchy:workspace-1:user-1:admin", 30, loader);
    await cache.invalidateAll();
    const refreshed = await cache.getOrLoad("hierarchy:workspace-1:user-1:admin", 30, loader);

    expect(refreshed).toEqual({ listCount: 3 });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(redis.values.get("api-read-cache:generation")).toBe("1");
  });

  test("uses its bounded local fallback while Redis is unavailable", async () => {
    const redis = new FakeRedis();
    redis.status = "end";
    const cache = new ApiReadCacheService(redis as any);
    const loader = jest.fn().mockResolvedValue({ tasks: ["task-1"] });

    await cache.getOrLoad("tasks:list-1:user-1", 15, loader);
    const cached = await cache.getOrLoad("tasks:list-1:user-1", 15, loader);

    expect(cached).toEqual({ tasks: ["task-1"] });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.values.size).toBe(0);
  });

  test("invalidates chat reads without evicting unrelated shared reads", async () => {
    const redis = new FakeRedis();
    const cache = new ApiReadCacheService(redis as any);
    const chatLoader = jest.fn()
      .mockResolvedValueOnce({ messages: ["old"] })
      .mockResolvedValueOnce({ messages: ["new"] });
    const hierarchyLoader = jest.fn().mockResolvedValue({ spaces: ["space-1"] });

    await cache.getOrLoad("recent:channel-1:user-1", 10, chatLoader, "chat-messages");
    await cache.getOrLoad("hierarchy:workspace-1:user-1", 30, hierarchyLoader);
    await cache.invalidateNamespace("chat-messages");
    const recent = await cache.getOrLoad("recent:channel-1:user-1", 10, chatLoader, "chat-messages");
    const hierarchy = await cache.getOrLoad("hierarchy:workspace-1:user-1", 30, hierarchyLoader);

    expect(recent).toEqual({ messages: ["new"] });
    expect(hierarchy).toEqual({ spaces: ["space-1"] });
    expect(chatLoader).toHaveBeenCalledTimes(2);
    expect(hierarchyLoader).toHaveBeenCalledTimes(1);
  });
});
