const express = require("express");
const { getSubscriptionInfo } = require("../middlewares/subscriptionMiddleware");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/subscription/info:
 *   get:
 *     summary: Get current user's subscription information
 *     description: Returns subscription details including plan, usage, and trial status
 *     tags: [Subscription]
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
 *                       enum: [trial, active, expired]
 *                     trialDaysRemaining:
 *                       type: number
 *                     trialExpired:
 *                       type: boolean
 *                     plan:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         price:
 *                           type: number
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
 *       404:
 *         description: User not found
 */
router.get("/info", protect, getSubscriptionInfo);

/**
 * @route   GET /api/subscription/next-plan
 * @desc    Get the next available higher-tier plan
 * @access  Private
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
