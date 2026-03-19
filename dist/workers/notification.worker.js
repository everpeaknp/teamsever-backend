"use strict";
/**
 * Notification Worker (Stub)
 *
 * This is a placeholder for the notification worker system.
 * Currently not in use - notifications are handled directly via Socket.io
 *
 * If you need to implement a worker system in the future:
 * 1. Install BullMQ: npm install bullmq ioredis
 * 2. Set up Redis connection
 * 3. Create worker to process queue jobs
 * 4. Handle job processing and errors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeWorker = void 0;
const closeWorker = async () => {
    console.log('[Worker] No worker to close (stub)');
    return Promise.resolve();
};
exports.closeWorker = closeWorker;
// Export empty object for compatibility
module.exports = {
    closeWorker: exports.closeWorker
};
