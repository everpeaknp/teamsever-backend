"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { getAdminUsers, updateUserSubscription, getFinancialAnalytics, getSystemSettings, updateSystemSettings } = require("../controllers/superAdminController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();
// All routes require authentication and super user privileges
router.use(protect);
/**
 * @swagger
 * /api/super-admin/users:
 *   get:
 *     summary: Get all workspace admins/owners
 *     description: Retrieve all workspace owners with subscription details (Super User only)
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of admin users
 *       403:
 *         description: Access denied
 */
router.get("/users", getAdminUsers);
/**
 * @swagger
 * /api/super-admin/users/{userId}/subscription:
 *   patch:
 *     summary: Update user subscription
 *     description: Update subscription status and plan for a user (Super User only)
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
 *               planId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [trial, active, expired]
 *     responses:
 *       200:
 *         description: Subscription updated
 *       403:
 *         description: Access denied
 *       404:
 *         description: User or plan not found
 */
router.patch("/users/:userId/subscription", updateUserSubscription);
/**
 * @swagger
 * /api/super-admin/analytics:
 *   get:
 *     summary: Get financial analytics
 *     description: Retrieve revenue, conversion rate, and signup data (Super User only)
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial analytics data
 *       403:
 *         description: Access denied
 */
router.get("/analytics", getFinancialAnalytics);
/**
 * @swagger
 * /api/super-admin/settings:
 *   get:
 *     summary: Get system settings
 *     description: Retrieve global system settings (Super User only)
 *     tags: [Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings
 *       403:
 *         description: Access denied
 *   put:
 *     summary: Update system settings
 *     description: Update global system settings (Super User only)
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
 *     responses:
 *       200:
 *         description: Settings updated
 *       403:
 *         description: Access denied
 */
router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);
module.exports = router;
