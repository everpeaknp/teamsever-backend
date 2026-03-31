"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionInfo = exports.checkRowLimit = exports.checkTableLimit = exports.checkFolderLimit = exports.checkListLimit = exports.checkSpaceLimit = exports.checkTaskLimit = exports.checkAccessControlFeature = exports.checkMemberLimit = exports.checkWorkspaceLimit = exports.checkSubscriptionLimit = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const entitlementService_1 = __importDefault(require("../services/entitlementService"));
const subscriptionLimits_1 = require("../config/subscriptionLimits");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Plan = require("../models/Plan");
const List = require("../models/List");
const Space = require("../models/Space");
const CustomTable = require("../models/CustomTable");
const PlanInheritanceService = require('../services/planInheritanceService').default;
/**
 * Helper to get resolved plan features for a user/owner
 */
const getPlanFeatures = async (user) => {
    if (user.subscription?.isPaid && user.subscription.planId) {
        const plan = user.subscription.planId;
        const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
        return { features: resolvedFeatures, planName: plan.name, isPaid: true };
    }
    // Fallback to Free Plan
    const freePlan = await Plan.findOne({
        name: { $regex: /free/i },
        isActive: true
    }).lean();
    if (freePlan) {
        const resolvedFeatures = await PlanInheritanceService.resolveFeatures(freePlan);
        return { features: resolvedFeatures, planName: freePlan.name, isPaid: false };
    }
    return { features: subscriptionLimits_1.DEFAULT_LIMITS, planName: 'Free (Default)', isPaid: false };
};
/**
 * Generic limit checker
 */
const validateLimit = async (resourceKey, req, res, next, getOwnerId) => {
    try {
        if (req.user?.isSuperUser)
            return next();
        const userId = req.user?.id;
        const config = subscriptionLimits_1.LIMIT_CONFIG[resourceKey];
        // 1. Determine whose limits we are checking (User or Workspace Owner)
        let targetUserId = userId;
        if (getOwnerId) {
            targetUserId = await getOwnerId(req);
            if (!targetUserId) {
                return res.status(400).json({ success: false, message: "Context ID required for limit check" });
            }
        }
        // 2. Get target user with plan
        const targetUser = await User.findById(targetUserId).populate('subscription.planId');
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }
        // 3. Get plan features (resolved with inheritance if needed)
        const { features, isPaid } = await getPlanFeatures(targetUser);
        // 4. Check feature availability (if applicable)
        if (config.featureField && !features[config.featureField]) {
            return res.status(403).json({
                success: false,
                message: config.featureMessage,
                code: config.featureErrorCode,
                isPaid,
                action: "upgrade",
                feature: resourceKey
            });
        }
        // 5. Check numeric limit
        const maxAllowed = features[config.planField] ?? config.defaultLimit;
        // -1 means unlimited
        if (maxAllowed === -1)
            return next();
        // 6. Get current usage
        let currentCount = 0;
        if (resourceKey === 'members') {
            // Custom logic for members: count active members in workspace
            const workspaceId = req.params?.workspaceId || req.body?.workspaceId;
            const workspace = await Workspace.findById(workspaceId);
            currentCount = workspace?.members?.filter((m) => m.status === 'active').length || 0;
            // Special case: check subscription.memberCount field for paid users
            const subMax = targetUser.subscription?.memberCount;
            if (isPaid && subMax) {
                if (currentCount >= subMax) {
                    return res.status(403).json({
                        success: false,
                        message: config.message(subMax, currentCount),
                        code: config.errorCode,
                        currentCount,
                        maxAllowed: subMax,
                        isPaid,
                        action: "upgrade"
                    });
                }
                return next();
            }
        }
        else {
            const usage = await entitlementService_1.default.getTotalUsage(targetUserId);
            currentCount = usage[config.usageField] || 0;
        }
        if (currentCount >= maxAllowed) {
            return res.status(403).json({
                success: false,
                message: config.message(maxAllowed, currentCount),
                code: config.errorCode,
                currentCount,
                maxAllowed,
                isPaid,
                action: "upgrade",
                feature: resourceKey
            });
        }
        next();
    }
    catch (error) {
        console.error(`[Limit Check: ${resourceKey}] Error:`, error);
        return res.status(500).json({ success: false, message: `Error checking ${resourceKey} limit` });
    }
};
/**
 * Check if user's subscription is valid and not expired
 */
const checkSubscriptionLimit = async (req, res, next) => {
    try {
        if (req.user?.isSuperUser)
            return next();
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: "Authentication required" });
        const user = await User.findById(userId).populate('subscription.planId');
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        if (!user.subscription) {
            user.subscription = { isPaid: false, status: 'free' };
        }
        let subscriptionExpired = false;
        let daysRemaining = 0;
        if (user.subscription.isPaid && user.subscription.expiresAt) {
            const expiryDate = new Date(user.subscription.expiresAt);
            const now = new Date();
            daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            subscriptionExpired = daysRemaining <= 0;
            if (subscriptionExpired && user.subscription.status === 'active') {
                user.subscription.status = 'expired';
                user.subscription.isPaid = false;
                await user.save();
            }
        }
        if (subscriptionExpired) {
            return res.status(403).json({
                success: false,
                message: "Your subscription has expired. Upgrade your plan to continue accessing premium features.",
                code: "SUBSCRIPTION_EXPIRED",
                daysRemaining: 0,
                isPaid: false,
                action: "upgrade"
            });
        }
        req.subscription = {
            isPaid: user.subscription.isPaid,
            status: user.subscription.status,
            plan: user.subscription.planId,
            subscriptionExpired,
            daysRemaining: Math.max(0, daysRemaining)
        };
        next();
    }
    catch (error) {
        console.error("[Subscription Middleware] Error:", error);
        return res.status(500).json({ success: false, message: "Error checking subscription status" });
    }
};
exports.checkSubscriptionLimit = checkSubscriptionLimit;
const checkWorkspaceLimit = (req, res, next) => validateLimit('workspaces', req, res, next);
exports.checkWorkspaceLimit = checkWorkspaceLimit;
const checkMemberLimit = (req, res, next) => validateLimit('members', req, res, next, async (r) => {
    const wsId = (r.params?.workspaceId || r.body?.workspaceId);
    if (!wsId)
        return null;
    const ws = await Workspace.findById(wsId).select('owner').lean();
    return ws?.owner?.toString() || null;
});
exports.checkMemberLimit = checkMemberLimit;
const checkTaskLimit = (req, res, next) => validateLimit('tasks', req, res, next, async (r) => {
    const wsId = (r.body?.workspace || r.params?.workspaceId);
    const listId = (r.body?.list || r.params?.listId);
    let finalWsId = wsId;
    if (!finalWsId && listId) {
        const list = await List.findById(listId).select('workspace').lean();
        finalWsId = list?.workspace?.toString();
    }
    return finalWsId ? (await entitlementService_1.default.getWorkspaceOwner(finalWsId)) : null;
});
exports.checkTaskLimit = checkTaskLimit;
const checkSpaceLimit = (req, res, next) => validateLimit('spaces', req, res, next, async (r) => {
    const wsId = r.params?.workspaceId;
    return wsId ? (await entitlementService_1.default.getWorkspaceOwner(wsId)) : null;
});
exports.checkSpaceLimit = checkSpaceLimit;
const checkListLimit = (req, res, next) => validateLimit('lists', req, res, next, async (r) => {
    const spaceId = r.params?.spaceId;
    if (!spaceId)
        return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString())) : null;
});
exports.checkListLimit = checkListLimit;
const checkFolderLimit = (req, res, next) => validateLimit('folders', req, res, next, async (r) => {
    const spaceId = (r.params?.spaceId || r.body?.space);
    if (!spaceId)
        return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString())) : null;
});
exports.checkFolderLimit = checkFolderLimit;
const checkTableLimit = (req, res, next) => validateLimit('tables', req, res, next, async (r) => {
    const spaceId = r.params?.spaceId;
    if (!spaceId)
        return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString())) : null;
});
exports.checkTableLimit = checkTableLimit;
const checkRowLimit = (req, res, next) => validateLimit('rows', req, res, next, async (r) => {
    const tableId = r.params?.tableId;
    if (!tableId)
        return null;
    const table = await CustomTable.findById(tableId).select('spaceId').lean();
    if (!table)
        return null;
    const space = await Space.findById(table.spaceId).select('workspace').lean();
    return space ? (await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString())) : null;
});
exports.checkRowLimit = checkRowLimit;
const checkAccessControlFeature = async (req, res, next) => {
    try {
        if (req.user?.isSuperUser)
            return next();
        const user = await User.findById(req.user?.id).populate('subscription.planId');
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const { features, isPaid } = await getPlanFeatures(user);
        if (!features.hasAccessControl) {
            return res.status(403).json({
                success: false,
                message: "Advanced access control features are not available in your current plan. Upgrade to Pro or Advanced to unlock custom permissions and role management.",
                code: "ACCESS_CONTROL_UNAVAILABLE",
                isPaid,
                action: "upgrade",
                feature: "access_control"
            });
        }
        next();
    }
    catch (error) {
        console.error("[Access Control Check] Error:", error);
        return res.status(500).json({ success: false, message: "Error checking access control feature" });
    }
};
exports.checkAccessControlFeature = checkAccessControlFeature;
/**
 * Get user's subscription info (for frontend) - with GLOBAL usage
 */
const getSubscriptionInfo = async (req, res) => {
    try {
        const userId = req.user?.id;
        const user = await User.findById(userId).populate('subscription.planId');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        // Calculate subscription expiry info
        let subscriptionExpired = false;
        let daysRemaining = 0;
        if (user.subscription?.isPaid && user.subscription.expiresAt) {
            const expiryDate = new Date(user.subscription.expiresAt);
            const now = new Date();
            const timeDiff = expiryDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            subscriptionExpired = daysRemaining <= 0;
            // Auto-deactivate expired subscriptions
            if (subscriptionExpired && user.subscription.status === 'active') {
                user.subscription.status = 'expired';
                user.subscription.isPaid = false;
                await user.save();
            }
        }
        // Get GLOBAL usage across all workspaces owned by this user
        let usage = {
            totalWorkspaces: 0,
            totalSpaces: 0,
            totalLists: 0,
            totalFolders: 0,
            totalTasks: 0
        };
        try {
            if (mongoose_1.default.Types.ObjectId.isValid(userId)) {
                usage = await entitlementService_1.default.getTotalUsage(userId);
            }
        }
        catch (usageError) {
            console.error("[Get Subscription Info] Usage Calculation Error:", usageError);
            // Continue with zero usage if calculation fails
        }
        // Get plan details
        let features = subscriptionLimits_1.DEFAULT_LIMITS;
        let planName = 'Free (Default)';
        try {
            const planRes = await getPlanFeatures(user);
            features = planRes.features;
            planName = planRes.planName;
        }
        catch (planError) {
            console.error("[Get Subscription Info] Plan Resolution Error:", planError);
            // Continue with default free features if resolution fails
        }
        res.status(200).json({
            success: true,
            data: {
                isPaid: user.subscription?.isPaid || false,
                status: user.subscription?.status || 'free',
                daysRemaining: Math.max(0, daysRemaining),
                subscriptionExpired,
                expiresAt: user.subscription?.expiresAt || null,
                memberCount: user.subscription?.memberCount || null,
                billingCycle: user.subscription?.billingCycle || null,
                plan: {
                    _id: user.subscription?.planId?._id || null,
                    name: planName,
                    features: features
                },
                usage: {
                    workspaces: usage.totalWorkspaces || 0,
                    spaces: usage.totalSpaces || 0,
                    lists: usage.totalLists || 0,
                    folders: usage.totalFolders || 0,
                    tasks: usage.totalTasks || 0
                }
            }
        });
    }
    catch (error) {
        console.error("[Get Subscription Info] Global Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching subscription info"
        });
    }
};
exports.getSubscriptionInfo = getSubscriptionInfo;
