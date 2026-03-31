const express = require("express");
const { getSubscriptionInfo } = require("../middlewares/subscriptionMiddleware");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/subscription/info:
 *   get:
 *     summary: Get current user's subscription information
 *     description: Returns detailed subscription info including plan features, unified global usage, and expiry details.
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription information retrieved successfully
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
 *                     isPaid:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                       enum: [active, expired, free]
 *                     daysRemaining:
 *                       type: number
 *                     subscriptionExpired:
 *                       type: boolean
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     memberCount:
 *                       type: number
 *                     billingCycle:
 *                       type: string
 *                     plan:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         features:
 *                           type: object
 *                     usage:
 *                       type: object
 *                       properties:
 *                         workspaces:
 *                           type: number
 *                         spaces:
 *                           type: number
 *                         lists:
 *                           type: number
 *                         folders:
 *                           type: number
 *                         tasks:
 *                           type: number
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/info", protect, getSubscriptionInfo);

/**
 * @swagger
 * /api/subscription/next-plan:
 *   get:
 *     summary: Get the next higher tier plan
 *     description: Returns the details of the next available plan with a higher price than the current user's plan.
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Next plan retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 hasNextPlan: true
 *                 nextPlan:
 *                   _id: "plan_id"
 *                   name: "Pro"
 *                   price: 20
 *                   features: {}
 */
router.get("/next-plan", protect, async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const Plan = require("../models/Plan");
    const User = require("../models/User");

    // Determine current plan from the authenticated user subscription
    const user = await User.findById(req.user.id).populate("subscription.planId");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const currentPlan = user.subscription?.planId;
    const currentPrice = currentPlan?.price || 0;
    
    // Find the next higher-priced plan
    const nextPlan = await Plan.findOne({
      price: { $gt: currentPrice },
      isActive: true
    }).sort({ price: 1 }).limit(1);
    
    if (!nextPlan) {
      return res.status(200).json({
        success: true,
        data: {
          hasNextPlan: false,
          nextPlan: null
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        hasNextPlan: true,
        nextPlan: {
          _id: nextPlan._id,
          name: nextPlan.name,
          price: nextPlan.price,
          features: nextPlan.features
        }
      }
    });
  } catch (error: any) {
    console.error('[getNextPlan] Error:', error);
    // Return empty result instead of 500 error
    res.status(200).json({
      success: true,
      data: {
        hasNextPlan: false,
        nextPlan: null
      }
    });
  }
});

module.exports = router;

export {};
