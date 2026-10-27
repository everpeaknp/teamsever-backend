import { getRedisRetryDelay } from "../config/redis";

describe("Redis reconnect policy", () => {
  test("continues retrying after the sixth attempt with capped backoff", () => {
    expect(getRedisRetryDelay(1)).toBe(1000);
    expect(getRedisRetryDelay(6)).toBe(6000);
    expect(getRedisRetryDelay(20)).toBe(10000);
  });

  test("does not connect to localhost when Redis is not configured", () => {
    const original = {
      nodeEnv: process.env.NODE_ENV,
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT,
      redisUrl: process.env.REDIS_URL,
    };
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = "development";

    jest.isolateModules(() => {
      const redis = require("../config/redis").default;
      expect(redis.status).toBe("end");
      expect(redis.get).toBeDefined();
      expect(redis.setex).toBeDefined();
    });

    process.env.NODE_ENV = original.nodeEnv;
    if (original.redisHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = original.redisHost;
    if (original.redisPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = original.redisPort;
    if (original.redisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original.redisUrl;
  });
});
