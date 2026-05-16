import Redis from 'ioredis';

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

export default redis;
