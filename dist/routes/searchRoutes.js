"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { handleGlobalSearch } = require("../controllers/searchController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();
// Defensive check
console.log("[DEBUG] protect type:", typeof protect);
console.log("[DEBUG] protect value:", protect);
console.log("[DEBUG] handleGlobalSearch type:", typeof handleGlobalSearch);
console.log("[DEBUG] handleGlobalSearch value:", handleGlobalSearch);
if (typeof handleGlobalSearch !== 'function') {
    console.error("❌ CRITICAL ERROR: handleGlobalSearch is not a function!");
    console.error("Type:", typeof handleGlobalSearch);
    console.error("Value:", handleGlobalSearch);
}
if (typeof protect !== 'function') {
    console.error("❌ CRITICAL ERROR: protect is not a function!");
    console.error("Type:", typeof protect);
    console.error("Value:", protect);
}
/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global search across tasks, spaces, and lists
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query string
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     type: object
 *                 spaces:
 *                   type: array
 *                   items:
 *                     type: object
 *                 lists:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, handleGlobalSearch);
module.exports = router;
