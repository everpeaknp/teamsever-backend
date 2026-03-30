const express = require("express");
const {
  getAdminUsers,
  updateUserSubscription,
  getFinancialAnalytics,
  getSystemSettings,
  updateSystemSettings
} = require("../controllers/superAdminController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// All routes require authentication and super user privileges
router.use(protect);

/**
 * @swagger
 * /api/super-admin/users:
 *   get:
 *     summary: Get all workspace admins/owners
 *     description: Retrieve all workspace owners with their full subscription details. Restricted to Super Admins only.
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of admin users retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bce50b96fe109fe4e14ff6"
 *                   name: "John Doe"
 *                   email: "john@example.com"
 *                   subscription:
 *                     plan: "Pro Plan"
 *                     status: "active"
 *                     isPaid: true
 *                     expiresAt: "2026-12-31T23:59:59Z"
 *       403:
 *         description: Forbidden - Super Admin privileges required
 */
router.get("/users", getAdminUsers);

/**
 * @swagger
 * /api/super-admin/users/{userId}/subscription:
 *   patch:
 *     summary: Update user subscription
 *     description: Manually override or update a user's subscription status and plan.
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPaid:
 *                 type: boolean
 *                 example: true
 *               planId:
 *                 type: string
 *                 example: "69bbf827a96fe78f716751aa"
 *               status:
 *                 type: string
 *                 enum: [trial, active, expired]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Subscription updated for John Doe"
 *       403:
 *         description: Forbidden - Super Admin privileges required
 *       404:
 *         description: User or Plan not found
 */
router.patch("/users/:userId/subscription", updateUserSubscription);

/**
 * @swagger
 * /api/super-admin/analytics:
 *   get:
 *     summary: Get system-wide financial analytics
 *     description: Retrieve global revenue, conversion rates, and user signup trends.
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial analytics data retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 totalRevenue: 150000
 *                 activePaidUsers: 450
 *                 conversionRate: 12.5
 *                 signupsLast30Days: 120
 *       403:
 *         description: Forbidden - Super Admin privileges required
 */
router.get("/analytics", getFinancialAnalytics);

/**
 * @swagger
 * /api/super-admin/settings:
 *   get:
 *     summary: Get global system settings
 *     description: Retrieve system-wide configuration settings like support contact numbers.
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 whatsappContactNumber: "+9779876543210"
 *       403:
 *         description: Forbidden
 *   put:
 *     summary: Update global system settings
 *     description: Update system-wide configuration.
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               whatsappContactNumber:
 *                 type: string
 *                 example: "+9779800000000"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Settings updated"
 *       403:
 *         description: Forbidden
 */
router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);

module.exports = router;

export {};
