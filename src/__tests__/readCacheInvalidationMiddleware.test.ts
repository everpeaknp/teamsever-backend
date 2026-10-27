jest.mock("../services/apiReadCacheService", () => ({
  __esModule: true,
  default: { invalidateAll: jest.fn().mockResolvedValue(undefined) },
}));

const { EventEmitter } = require("events");
const cache = require("../services/apiReadCacheService").default;
const { readCacheInvalidationMiddleware } = require("../middlewares/readCacheInvalidationMiddleware");

const response = (statusCode: number) => {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  return res;
};

describe("read cache invalidation middleware", () => {
  beforeEach(() => cache.invalidateAll.mockClear());

  test("invalidates shared reads after a successful task write", async () => {
    const req = { method: "PATCH", originalUrl: "/api/tasks/task-1" };
    const res = response(200);
    const next = jest.fn();

    readCacheInvalidationMiddleware(req, res, next);
    res.emit("finish");
    await new Promise(setImmediate);

    expect(next).toHaveBeenCalledTimes(1);
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
  });

  test("does not invalidate after failed writes or unrelated requests", async () => {
    const next = jest.fn();
    const failed = response(500);
    readCacheInvalidationMiddleware(
      { method: "POST", originalUrl: "/api/lists/list-1/tasks" },
      failed,
      next,
    );
    failed.emit("finish");

    const unrelated = response(200);
    readCacheInvalidationMiddleware(
      { method: "POST", originalUrl: "/api/dm/messages" },
      unrelated,
      next,
    );
    unrelated.emit("finish");
    await new Promise(setImmediate);

    expect(cache.invalidateAll).not.toHaveBeenCalled();
  });
});
