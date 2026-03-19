"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Plan = require("../models/Plan");
const SystemSettings = require("../models/SystemSettings");
const asyncHandler = require("../utils/asyncHandler");
/**
 * @desc    Get all users with subscription details
 * @route   GET /api/super-admin/users
 * @access  Private (Super User only)
 */
const getAdminUsers = asyncHandler(async (req, res) => {
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    // Get ALL users (not just workspace owners)
    const allUsers = await User.find({ isSuperUser: { $ne: true } })
        .select("name email subscription createdAt")
        .sort({ createdAt: -1 });
    const adminUsers = [];
    for (const user of allUsers) {
        // Count workspaces owned by this user
        const workspaceCount = await Workspace.countDocuments({
            owner: user._id,
            isDeleted: false
        });
        // Calculate days remaining for paid users
        let daysRemaining = undefined;
        if (user.subscription?.isPaid && user.subscription?.expiresAt) {
            const now = new Date();
            const expiryDate = new Date(user.subscription.expiresAt);
            const timeDiff = expiryDate.getTime() - now.getTime();
            daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        }
        // Get plan details if exists
        let planDetails = null;
        if (user.subscription?.planId) {
            planDetails = await Plan.findById(user.subscription.planId);
        }
        adminUsers.push({
            _id: user._id,
            name: user.name,
            email: user.email,
            workspaceCount,
            subscription: {
                planId: user.subscription?.planId || null,
                planName: planDetails?.name || "Free Plan",
                planPrice: planDetails?.basePrice || planDetails?.price || 0,
                planBaseCurrency: planDetails?.baseCurrency || 'NPR',
                isPaid: user.subscription?.isPaid || false,
                status: user.subscription?.status || "free",
                expiresAt: user.subscription?.expiresAt,
                daysRemaining
            },
            createdAt: user.createdAt
        });
    }
    res.status(200).json({
        success: true,
        count: adminUsers.length,
        data: adminUsers
    });
});
/**
 * @desc    Update user subscription status
 * @route   PATCH /api/super-admin/users/:userId/subscription
 * @access  Private (Super User only)
 */
const updateUserSubscription = asyncHandler(async (req, res) => {
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    const { userId } = req.params;
    const { isPaid, planId, status } = req.body;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    // Verify plan exists if planId is provided
    if (planId) {
        const plan = await Plan.findById(planId);
        if (!plan) {
            res.status(404);
            throw new Error("Plan not found");
        }
    }
    // Update subscription
    if (!user.subscription) {
        user.subscription = {};
    }
    if (isPaid !== undefined) {
        user.subscription.isPaid = isPaid;
        if (isPaid) {
            user.subscription.status = 'active';
            // Set 30-day expiry from now
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            user.subscription.expiresAt = expiryDate;
            user.subscription.paidAt = new Date();
        }
        else {
            user.subscription.status = 'free';
            user.subscription.expiresAt = undefined;
            user.subscription.paidAt = undefined;
        }
    }
    if (planId !== undefined) {
        user.subscription.planId = planId;
    }
    if (status !== undefined) {
        user.subscription.status = status;
    }
    await user.save();
    // Invalidate entitlement cache when plan changes
    const EntitlementService = require('../services/entitlementService').default;
    EntitlementService.invalidateEntitlementCache(userId);
    EntitlementService.invalidateUsageCache(userId);
    // Get updated user with plan details
    const updatedUser = await User.findById(userId).populate('subscription.planId');
    res.status(200).json({
        success: true,
        data: updatedUser
    });
});
/**
 * @desc    Get financial analytics
 * @route   GET /api/super-admin/analytics
 * @access  Private (Super User only)
 */
const getFinancialAnalytics = asyncHandler(async (req, res) => {
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    // Get all users with subscriptions
    const allUsers = await User.find({}).populate('subscription.planId');
    // Calculate total revenue (sum of all paid users' plan prices)
    let totalRevenue = 0;
    const paidUsers = allUsers.filter(user => user.subscription?.isPaid);
    for (const user of paidUsers) {
        if (user.subscription?.planId && typeof user.subscription.planId === 'object') {
            // Use basePrice if available, otherwise use price
            totalRevenue += user.subscription.planId.basePrice || user.subscription.planId.price || 0;
        }
    }
    // Most plans are in NPR, so we'll use NPR as the base currency for total revenue
    const revenueBaseCurrency = 'NPR';
    // Calculate conversion rate (free to paid)
    const conversionRate = allUsers.length > 0
        ? ((paidUsers.length / allUsers.length) * 100).toFixed(2)
        : "0";
    // Get new signups per week (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks
    const signupsByWeek = await User.aggregate([
        {
            $match: {
                createdAt: { $gte: twelveWeeksAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    week: { $week: "$createdAt" }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.week": 1 }
        }
    ]);
    // Format signup data for chart
    const signupData = signupsByWeek.map(item => ({
        week: `Week ${item._id.week}`,
        count: item.count,
        year: item._id.year
    }));
    // Additional metrics
    const totalUsers = allUsers.length;
    const activeSubscriptions = allUsers.filter(user => user.subscription?.status === 'active').length;
    const expiredSubscriptions = allUsers.filter(user => user.subscription?.status === 'expired').length;
    res.status(200).json({
        success: true,
        data: {
            totalRevenue,
            revenueBaseCurrency,
            conversionRate: parseFloat(conversionRate),
            signupData,
            metrics: {
                totalUsers,
                paidUsers: paidUsers.length,
                activeSubscriptions,
                expiredSubscriptions
            }
        }
    });
});
/**
 * @desc    Get or create system settings
 * @route   GET /api/super-admin/settings
 * @access  Private (Super User only)
 */
const getSystemSettings = asyncHandler(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Not authenticated"
        });
    }
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({
                whatsappContactNumber: "+1234567890",
                updatedBy: req.user._id
            });
        }
        return res.status(200).json({
            success: true,
            data: settings
        });
    }
    catch (error) {
        console.error('[getSystemSettings] Error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch system settings"
        });
    }
});
/**
 * @desc    Update system settings
 * @route   PUT /api/super-admin/settings
 * @access  Private (Super User only)
 */
const updateSystemSettings = asyncHandler(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Not authenticated"
        });
    }
    if (!req.user.isSuperUser) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super user privileges required."
        });
    }
    try {
        const { whatsappContactNumber } = req.body;
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({
                whatsappContactNumber,
                updatedBy: req.user._id
            });
        }
        else {
            settings.whatsappContactNumber = whatsappContactNumber;
            settings.updatedBy = req.user._id;
            await settings.save();
        }
        return res.status(200).json({
            success: true,
            data: settings
        });
    }
    catch (error) {
        console.error('[updateSystemSettings] Error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update system settings"
        });
    }
});
module.exports = {
    getAdminUsers,
    updateUserSubscription,
    getFinancialAnalytics,
    getSystemSettings,
    updateSystemSettings
};
