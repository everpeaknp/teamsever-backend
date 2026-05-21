import Redis from 'ioredis';

// During tests we avoid connecting to a real Redis instance to prevent
// connection warnings and open handles. Export a small no-op stub instead.
let _redis: any;
if (process.env.NODE_ENV === 'test') {
  const noop = () => {};
  const stub: any = {
    get: async () => null,
    set: async () => null,
    del: async () => null,
    on: noop,
    quit: async () => null,
    disconnect: noop,
  };
  _redis = stub;
} else {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  const redisPassword = process.env.REDIS_PASSWORD;

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    retryStrategy(times) {
      if (times > 5) {
        console.warn('🟡 Redis: Max retries reached. Connection suspended.');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false, // Don't queue commands if Redis is down
  });

  redis.on('connect', () => {
    console.log('🟢 Redis connected');
  });

  redis.on('error', (err: any) => {
    if (err.code === 'ECONNREFUSED') {
      console.warn('🟡 Redis connection refused. Running without cache.');
    } else {
      console.error('🔴 Redis error:', err);
    }
  });

  _redis = redis;
}

export default _redis;
