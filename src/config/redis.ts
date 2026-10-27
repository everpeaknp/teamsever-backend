import Redis from 'ioredis';

export const getRedisRetryDelay = (attempt: number): number =>
  Math.min(Math.max(attempt, 1) * 1000, 10000);

// During tests we avoid connecting to a real Redis instance to prevent
// connection warnings and open handles. Export a small no-op stub instead.
let _redis: any;
const createDisabledRedis = () => {
  const noop = () => {};
  return {
    status: 'end',
    get: async () => null,
    set: async () => null,
    setex: async () => null,
    incr: async () => 0,
    del: async () => null,
    on: noop,
    quit: async () => null,
    disconnect: noop,
  };
};

if (process.env.NODE_ENV === 'test' || (!process.env.REDIS_URL && !process.env.REDIS_HOST)) {
  // Local development can use the bounded in-process fallback without requiring
  // a Redis daemon. Production should provide REDIS_URL or REDIS_HOST explicitly.
  _redis = createDisabledRedis();
} else {
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  const redisPassword = process.env.REDIS_PASSWORD;
  let unavailableWarningShown = false;

  const redisOptions = {
    ...(redisPassword ? { password: redisPassword } : {}),
    retryStrategy: getRedisRetryDelay,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false, // Don't queue commands if Redis is down
  };
  const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis({
        host: process.env.REDIS_HOST,
        port: redisPort,
        ...redisOptions,
      });

  redis.on('ready', () => {
    unavailableWarningShown = false;
    console.log('🟢 Redis ready; shared cache enabled');
  });

  redis.on('error', (err: any) => {
    if (err.code === 'ECONNREFUSED') {
      if (!unavailableWarningShown) {
        console.warn('🟡 Redis unavailable; using local fallback and retrying.');
        unavailableWarningShown = true;
      }
    } else {
      console.error('🔴 Redis error:', err);
    }
  });

  _redis = redis;
}

export default _redis;
