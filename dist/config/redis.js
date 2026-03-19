"use strict";
/**
 * Redis Configuration (Stub)
 *
 * This is a placeholder for Redis connection.
 * Currently not in use - we use in-memory socket management
 *
 * See backend/MULTI_DEVICE_SOCKET_IMPLEMENTATION.md for details
 *
 * If you need to implement Redis in the future:
 * 1. Install ioredis: npm install ioredis
 * 2. Set up Redis connection with proper config
 * 3. Export connection instance
 * 4. Implement closeRedis function
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedis = void 0;
const closeRedis = async () => {
    console.log('[Redis] No Redis connection to close (stub)');
    return Promise.resolve();
};
exports.closeRedis = closeRedis;
// Export empty object for compatibility
module.exports = {
    closeRedis: exports.closeRedis
};
