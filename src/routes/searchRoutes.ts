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
 *     description: Performs a full-text search across the user's accessible tasks, spaces, and lists in the current workspace (if provided in headers).
 *     tags: ["Productivity"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query string (min 3 characters recommended)
 *     responses:
 *       200:
 *         description: Search results grouped by entity type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                     spaces:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Space'
 *                     lists:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/List'
 *             example:
 *               success: true
 *               data:
 *                 tasks:
 *                   - _id: "69bbf827a96fe78f716755f4"
 *                     title: "Implement Authentication"
 *                     status: "in-progress"
 *                 spaces:
 *                   - _id: "69bbf827a96fe78f716753c1"
 *                     name: "Backend Development"
 *                 lists:
 *                   - _id: "69bbf827a96fe78f716753d2"
 *                     name: "Q1 Roadmap"
 *       400:
 *         description: Missing or invalid search query
 *       401:
 *         description: Unauthorized - Invalid token
 *       500:
 *         description: Search engine error
 */
router.get("/", protect, handleGlobalSearch);

module.exports = router;

export {};
