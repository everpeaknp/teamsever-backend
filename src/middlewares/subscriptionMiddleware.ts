import mongoose from "mongoose";
import { Response, NextFunction } from "express";
import entitlementService from "../services/entitlementService";
import { LIMIT_CONFIG, DEFAULT_LIMITS } from "../config/subscriptionLimits";
import type { AuthRequest } from "../types/express";

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
const getPlanFeatures = async (user: any) => {
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

  return { features: DEFAULT_LIMITS, planName: 'Free (Default)', isPaid: false };
};

/**
 * Generic limit checker
 */
const validateLimit = async (resourceKey: string, req: AuthRequest, res: Response, next: NextFunction, getOwnerId?: (req: AuthRequest) => Promise<string | null>) => {
  try {
    if (req.user?.isSuperUser) return next();

    const userId = req.user?.id;
    const config = LIMIT_CONFIG[resourceKey];
    
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
    if (maxAllowed === -1) return next();

    // 6. Get current usage
    let currentCount = 0;
    if (resourceKey === 'members') {
      // Custom logic for members: count active members in workspace
      const workspaceId = req.params?.workspaceId || req.body?.workspaceId;
      const workspace = await Workspace.findById(workspaceId);
      currentCount = workspace?.members?.filter((m: any) => m.status === 'active').length || 0;
      
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
    } else {
      const usage = await entitlementService.getTotalUsage(targetUserId as string);
      currentCount = (usage as any)[config.usageField!] || 0;
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
  } catch (error: any) {
    console.error(`[Limit Check: ${resourceKey}] Error:`, error);
    return res.status(500).json({ success: false, message: `Error checking ${resourceKey} limit` });
  }
};

/**
 * Check if user's subscription is valid and not expired
 */
const checkSubscriptionLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.isSuperUser) return next();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });

    const user = await User.findById(userId).populate('subscription.planId');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
  } catch (error: any) {
    console.error("[Subscription Middleware] Error:", error);
    return res.status(500).json({ success: false, message: "Error checking subscription status" });
  }
};

const checkWorkspaceLimit = (req: any, res: any, next: any) => validateLimit('workspaces', req, res, next);

const checkMemberLimit = (req: any, res: any, next: any) => 
  validateLimit('members', req, res, next, async (r) => {
    const wsId = (r.params?.workspaceId || r.body?.workspaceId) as string;
    if (!wsId) return null;
    const ws = await Workspace.findById(wsId).select('owner').lean();
    return ws?.owner?.toString() || null;
  });

const checkTaskLimit = (req: any, res: any, next: any) => 
  validateLimit('tasks', req, res, next, async (r) => {
    const wsId = (r.body?.workspace || r.params?.workspaceId) as string;
    const listId = (r.body?.list || r.params?.listId) as string;
    let finalWsId = wsId;
    if (!finalWsId && listId) {
      const list = await List.findById(listId).select('workspace').lean();
      finalWsId = list?.workspace?.toString();
    }
    return finalWsId ? (await entitlementService.getWorkspaceOwner(finalWsId)) : null;
  });

const checkSpaceLimit = (req: any, res: any, next: any) => 
  validateLimit('spaces', req, res, next, async (r) => {
    const wsId = r.params?.workspaceId as string;
    return wsId ? (await entitlementService.getWorkspaceOwner(wsId)) : null;
  });

const checkListLimit = (req: any, res: any, next: any) => 
  validateLimit('lists', req, res, next, async (r) => {
    const spaceId = r.params?.spaceId as string;
    if (!spaceId) return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService.getWorkspaceOwner(space.workspace.toString())) : null;
  });

const checkFolderLimit = (req: any, res: any, next: any) => 
  validateLimit('folders', req, res, next, async (r) => {
    const spaceId = (r.params?.spaceId || r.body?.space) as string;
    if (!spaceId) return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService.getWorkspaceOwner(space.workspace.toString())) : null;
  });

const checkTableLimit = (req: any, res: any, next: any) => 
  validateLimit('tables', req, res, next, async (r) => {
    const spaceId = r.params?.spaceId as string;
    if (!spaceId) return null;
    const space = await Space.findById(spaceId).select('workspace').lean();
    return space ? (await entitlementService.getWorkspaceOwner(space.workspace.toString())) : null;
  });

const checkRowLimit = (req: any, res: any, next: any) => 
  validateLimit('rows', req, res, next, async (r) => {
    const tableId = r.params?.tableId as string;
    if (!tableId) return null;
    const table = await CustomTable.findById(tableId).select('spaceId').lean();
    if (!table) return null;
    const space = await Space.findById(table.spaceId).select('workspace').lean();
    return space ? (await entitlementService.getWorkspaceOwner(space.workspace.toString())) : null;
  });

const checkAccessControlFeature = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.isSuperUser) return next();
    const user = await User.findById(req.user?.id).populate('subscription.planId');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
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
  } catch (error) {
    console.error("[Access Control Check] Error:", error);
    return res.status(500).json({ success: false, message: "Error checking access control feature" });
  }
};

/**
 * Get user's subscription info (for frontend) - with GLOBAL usage
 */
const getSubscriptionInfo = async (req: AuthRequest, res: Response) => {
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
      if (mongoose.Types.ObjectId.isValid(userId)) {
        usage = await entitlementService.getTotalUsage(userId as string);
      }
    } catch (usageError) {
      console.error("[Get Subscription Info] Usage Calculation Error:", usageError);
      // Continue with zero usage if calculation fails
    }

    // Get plan details
    let features = DEFAULT_LIMITS;
    let planName = 'Free (Default)';

    try {
      const planRes = await getPlanFeatures(user);
      features = planRes.features;
      planName = planRes.planName;
    } catch (planError) {
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
  } catch (error: any) {
    console.error("[Get Subscription Info] Global Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching subscription info"
    });
  }
};

export {
  checkSubscriptionLimit,
  checkWorkspaceLimit,
  checkMemberLimit,
  checkAccessControlFeature,
  checkTaskLimit,
  checkSpaceLimit,
  checkListLimit,
  checkFolderLimit,
  checkTableLimit,
  checkRowLimit,
  getSubscriptionInfo
};
