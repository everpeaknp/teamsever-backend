"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const entitlementService_1 = __importDefault(require("../services/entitlementService"));
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Plan = require("../models/Plan");
const List = require("../models/List");
/**
 * Check if user's subscription is valid and not expired
 */
const checkSubscriptionLimit = async (req, res, next) => {
    try {
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            return next();
        }
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        // Get user with subscription details
        const user = await User.findById(userId).populate('subscription.planId');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        // If user has no subscription, treat as free plan
        if (!user.subscription) {
            user.subscription = {
                isPaid: false,
                status: 'free'
            };
        }
        // Check if paid subscription has expired
        let subscriptionExpired = false;
        let daysRemaining = 0;
        if (user.subscription.isPaid && user.subscription.expiresAt) {
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
        // If subscription expired, restrict access to paid features
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
        // Attach subscription info to request for use in controllers
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
        return res.status(500).json({
            success: false,
            message: "Error checking subscription status"
        });
    }
};
/**
 * Check workspace creation limit based on plan (GLOBAL across all workspaces)
 */
const checkWorkspaceLimit = async (req, res, next) => {
    try {
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            return next();
        }
        const userId = req.user?.id;
        const user = await User.findById(userId).populate('subscription.planId');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        // Get GLOBAL usage for this user
        const usage = await entitlementService_1.default.getTotalUsage(userId);
        // Get plan limits
        let maxWorkspaces = 1; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (user.subscription?.isPaid && user.subscription.planId) {
            // Paid user - use their plan
            const plan = user.subscription.planId;
            maxWorkspaces = plan.features?.maxWorkspaces ?? 1;
            planName = plan.name;
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxWorkspaces = freePlan.features?.maxWorkspaces ?? 1;
                planName = freePlan.name;
            }
        }
        // Check if limit reached (-1 means unlimited)
        if (maxWorkspaces !== -1 && usage.totalWorkspaces >= maxWorkspaces) {
            return res.status(403).json({
                success: false,
                message: `You've reached your workspace limit (${maxWorkspaces}). Upgrade your plan to create more workspaces and expand your team's productivity.`,
                code: "WORKSPACE_LIMIT_REACHED",
                currentCount: usage.totalWorkspaces,
                maxAllowed: maxWorkspaces,
                isPaid: user.subscription?.isPaid || false,
                action: "upgrade",
                feature: "workspaces"
            });
        }
        next();
    }
    catch (error) {
        console.error("[Workspace Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking workspace limit"
        });
    }
};
/**
 * Check member invitation limit based on plan (checks workspace owner's limits)
 */
const checkMemberLimit = async (req, res, next) => {
    try {
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            return next();
        }
        const userId = req.user?.id;
        const workspaceId = req.params?.workspaceId || req.body?.workspaceId;
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID required"
            });
        }
        // Get workspace and find the owner
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({
                success: false,
                message: "Workspace not found"
            });
        }
        // ALWAYS check the workspace owner's limits, not the current user
        const ownerId = workspace.owner.toString();
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get current ACTIVE member count (only count active members, not removed/inactive ones)
        const currentMemberCount = workspace.members?.filter((m) => m.status === 'active').length || 0;
        console.log('[Member Limit] Total members in array:', workspace.members?.length);
        console.log('[Member Limit] Active members:', currentMemberCount);
        // Get member limit from OWNER's purchased member count
        let maxMembers = 5; // Fallback if no subscription found
        let planName = 'Free (Default)';
        console.log('[Member Limit] Owner subscription:', JSON.stringify(owner.subscription, null, 2));
        if (owner.subscription?.isPaid && owner.subscription.memberCount) {
            // Paid user - use their purchased member count
            maxMembers = owner.subscription.memberCount;
            const plan = owner.subscription.planId;
            planName = plan?.name || 'Paid Plan';
            console.log('[Member Limit] Using purchased member count:', maxMembers, 'from plan:', planName);
        }
        else if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user but no memberCount set (legacy) - fallback to plan's maxMembers
            const plan = owner.subscription.planId;
            maxMembers = plan.features?.maxMembers ?? 5;
            planName = plan.name || 'Unknown Plan';
            console.log('[Member Limit] Legacy subscription - using plan maxMembers:', maxMembers);
        }
        else {
            console.log('[Member Limit] No paid plan, checking for free plan in database');
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxMembers = freePlan.features?.maxMembers ?? 5;
                planName = freePlan.name;
                console.log('[Member Limit] Using free plan:', planName, 'with maxMembers:', maxMembers);
            }
            else {
                console.log('[Member Limit] No free plan found, using fallback maxMembers:', maxMembers);
            }
        }
        console.log('[Member Limit] Max members allowed:', maxMembers);
        console.log('[Member Limit] Current active members:', currentMemberCount);
        console.log('[Member Limit] After adding new member:', currentMemberCount + 1);
        console.log('[Member Limit] Check: Will adding new member exceed limit?', (currentMemberCount + 1) > maxMembers);
        // Check if adding a new member would exceed the limit (-1 means unlimited)
        if (maxMembers !== -1 && currentMemberCount >= maxMembers) {
            console.log('[Member Limit] BLOCKED: Member limit reached');
            return res.status(403).json({
                success: false,
                message: `This workspace has reached its member limit (${currentMemberCount}/${maxMembers}). Upgrade your plan to add more team members.`,
                code: "MEMBER_LIMIT_REACHED",
                currentCount: currentMemberCount,
                maxAllowed: maxMembers,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "members"
            });
        }
        console.log('[Member Limit] ALLOWED: Can add new member');
        next();
    }
    catch (error) {
        console.error("[Member Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking member limit"
        });
    }
};
/**
 * Check if user's plan has access control feature
 */
const checkAccessControlFeature = async (req, res, next) => {
    try {
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            return next();
        }
        const userId = req.user?.id;
        const user = await User.findById(userId).populate('subscription.planId');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        // Check if plan has access control
        let hasAccessControl = false;
        if (user.subscription?.isPaid && user.subscription.planId) {
            const plan = user.subscription.planId;
            hasAccessControl = plan.features?.hasAccessControl || false;
        }
        if (!hasAccessControl) {
            return res.status(403).json({
                success: false,
                message: "Advanced access control features are not available in your current plan. Upgrade to Pro or Advanced to unlock custom permissions and role management.",
                code: "ACCESS_CONTROL_UNAVAILABLE",
                isPaid: user.subscription?.isPaid || false,
                action: "upgrade",
                feature: "access_control"
            });
        }
        next();
    }
    catch (error) {
        console.error("[Access Control Check] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking access control feature"
        });
    }
};
/**
 * Check task creation limit based on plan (GLOBAL across all workspaces owned by workspace owner)
 */
const checkTaskLimit = async (req, res, next) => {
    try {
        console.log('[checkTaskLimit] Starting task limit check');
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            console.log('[checkTaskLimit] Super user detected, bypassing limit');
            return next();
        }
        // Get workspace ID from various possible locations
        const workspaceId = req.body?.workspace || req.params?.workspaceId;
        const listId = req.body?.list || req.params?.listId;
        // If we have listId but not workspaceId, get it from the list
        let finalWorkspaceId = workspaceId;
        if (!finalWorkspaceId && listId) {
            const list = await List.findById(listId).select('workspace').lean();
            if (list) {
                finalWorkspaceId = list.workspace.toString();
            }
        }
        if (!finalWorkspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID required"
            });
        }
        console.log('[checkTaskLimit] Workspace ID:', finalWorkspaceId);
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(finalWorkspaceId);
        console.log('[checkTaskLimit] Workspace owner ID:', ownerId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        console.log('[checkTaskLimit] Current usage:', usage);
        // Get plan limits from OWNER's subscription
        let maxTasks = 100; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan
            const plan = owner.subscription.planId;
            maxTasks = plan.features?.maxTasks ?? 100;
            planName = plan.name;
            console.log('[checkTaskLimit] Paid plan found:', planName, 'maxTasks:', maxTasks);
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxTasks = freePlan.features?.maxTasks ?? 100;
                planName = freePlan.name;
                console.log('[checkTaskLimit] Free plan found in database:', planName, 'maxTasks:', maxTasks);
            }
            else {
                console.log('[checkTaskLimit] No plan found, using hardcoded fallback:', maxTasks);
            }
        }
        console.log('[checkTaskLimit] Max tasks allowed:', maxTasks);
        console.log('[checkTaskLimit] Current task count:', usage.totalTasks);
        console.log('[checkTaskLimit] Check:', usage.totalTasks, '>=', maxTasks, '=', usage.totalTasks >= maxTasks);
        // Check if limit reached (-1 means unlimited)
        if (maxTasks !== -1 && usage.totalTasks >= maxTasks) {
            console.log('[checkTaskLimit] Task limit reached!');
            return res.status(403).json({
                success: false,
                message: `You've reached your task limit (${maxTasks} tasks). Upgrade your plan to create unlimited tasks and manage larger projects.`,
                code: "TASK_LIMIT_REACHED",
                currentCount: usage.totalTasks,
                maxAllowed: maxTasks,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "tasks"
            });
        }
        console.log('[checkTaskLimit] Limit check passed, proceeding');
        next();
    }
    catch (error) {
        console.error("[Task Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking task limit"
        });
    }
};
/**
 * Check space creation limit based on plan (GLOBAL across all workspaces owned by workspace owner)
 */
const checkSpaceLimit = async (req, res, next) => {
    try {
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            return next();
        }
        // Get workspace ID from params
        const workspaceId = req.params?.workspaceId;
        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: "Workspace ID required"
            });
        }
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(workspaceId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        // Get plan limits from OWNER's subscription
        let maxSpaces = 2; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan
            const plan = owner.subscription.planId;
            maxSpaces = plan.features?.maxSpaces ?? 2;
            planName = plan.name;
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxSpaces = freePlan.features?.maxSpaces ?? 2;
                planName = freePlan.name;
            }
        }
        // Check if limit reached (-1 means unlimited)
        if (maxSpaces !== -1 && usage.totalSpaces >= maxSpaces) {
            return res.status(403).json({
                success: false,
                message: `You've reached your space limit (${maxSpaces} spaces). Upgrade your plan to create more spaces and organize your work better.`,
                code: "SPACE_LIMIT_REACHED",
                currentCount: usage.totalSpaces,
                maxAllowed: maxSpaces,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "spaces"
            });
        }
        next();
    }
    catch (error) {
        console.error("[Space Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking space limit"
        });
    }
};
/**
 * Check list creation limit based on plan (GLOBAL across all workspaces owned by workspace owner)
 */
const checkListLimit = async (req, res, next) => {
    try {
        console.log('[checkListLimit] Starting list limit check');
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            console.log('[checkListLimit] Super user detected, bypassing limit');
            return next();
        }
        // Get space ID from params
        const spaceId = req.params?.spaceId;
        console.log('[checkListLimit] Space ID:', spaceId);
        if (!spaceId) {
            console.log('[checkListLimit] No space ID found');
            return res.status(400).json({
                success: false,
                message: "Space ID required"
            });
        }
        // Get space to find workspace
        const Space = require("../models/Space");
        const space = await Space.findById(spaceId).select('workspace').lean();
        if (!space) {
            console.log('[checkListLimit] Space not found');
            return res.status(404).json({
                success: false,
                message: "Space not found"
            });
        }
        console.log('[checkListLimit] Found space, workspace ID:', space.workspace);
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString());
        console.log('[checkListLimit] Workspace owner ID:', ownerId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            console.log('[checkListLimit] Owner not found');
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        console.log('[checkListLimit] Current usage:', usage);
        // Get plan limits from OWNER's subscription
        let maxLists = 4; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan
            const plan = owner.subscription.planId;
            maxLists = plan.features?.maxLists ?? 4;
            planName = plan.name;
            console.log('[checkListLimit] Paid plan found:', planName, 'maxLists:', maxLists);
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxLists = freePlan.features?.maxLists ?? 4;
                planName = freePlan.name;
                console.log('[checkListLimit] Free plan found in database:', planName, 'maxLists:', maxLists);
            }
            else {
                console.log('[checkListLimit] No plan found, using hardcoded fallback:', maxLists);
            }
        }
        console.log('[checkListLimit] Max lists allowed:', maxLists);
        console.log('[checkListLimit] Current list count:', usage.totalLists);
        console.log('[checkListLimit] Check:', usage.totalLists, '>=', maxLists, '=', usage.totalLists >= maxLists);
        // Check if limit reached (-1 means unlimited)
        if (maxLists !== -1 && usage.totalLists >= maxLists) {
            console.log('[checkListLimit] List limit reached!');
            return res.status(403).json({
                success: false,
                message: `You've reached your list limit (${maxLists} lists). Upgrade your plan to create more lists and manage your tasks better.`,
                code: "LIST_LIMIT_REACHED",
                currentCount: usage.totalLists,
                maxAllowed: maxLists,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "lists"
            });
        }
        console.log('[checkListLimit] Limit check passed, proceeding');
        next();
    }
    catch (error) {
        console.error("[List Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking list limit"
        });
    }
};
/**
 * Check folder creation limit based on plan (GLOBAL across all workspaces owned by workspace owner)
 */
const checkFolderLimit = async (req, res, next) => {
    try {
        console.log('[checkFolderLimit] Starting folder limit check');
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            console.log('[checkFolderLimit] Super user detected, bypassing limit');
            return next();
        }
        // Get space ID from params or body
        const spaceId = req.params?.spaceId || req.body?.space;
        console.log('[checkFolderLimit] Space ID:', spaceId);
        if (!spaceId) {
            console.log('[checkFolderLimit] No space ID found');
            return res.status(400).json({
                success: false,
                message: "Space ID required"
            });
        }
        // Get space to find workspace
        const Space = require("../models/Space");
        const space = await Space.findById(spaceId).select('workspace').lean();
        if (!space) {
            console.log('[checkFolderLimit] Space not found');
            return res.status(404).json({
                success: false,
                message: "Space not found"
            });
        }
        console.log('[checkFolderLimit] Found space, workspace ID:', space.workspace);
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString());
        console.log('[checkFolderLimit] Workspace owner ID:', ownerId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            console.log('[checkFolderLimit] Owner not found');
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        console.log('[checkFolderLimit] Current usage:', usage);
        // Get plan limits from OWNER's subscription with inheritance resolved
        let maxFolders = 2; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan with inheritance
            const plan = owner.subscription.planId;
            const PlanInheritanceService = require('../services/planInheritanceService').default;
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            maxFolders = resolvedFeatures.maxFolders ?? 2;
            planName = plan.name;
            console.log('[checkFolderLimit] Paid plan found:', planName, 'maxFolders:', maxFolders);
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                const PlanInheritanceService = require('../services/planInheritanceService').default;
                const resolvedFeatures = await PlanInheritanceService.resolveFeatures(freePlan);
                maxFolders = resolvedFeatures.maxFolders ?? 2;
                planName = freePlan.name;
                console.log('[checkFolderLimit] Free plan found in database:', planName, 'maxFolders:', maxFolders);
            }
            else {
                console.log('[checkFolderLimit] No plan found, using hardcoded fallback:', maxFolders);
            }
        }
        console.log('[checkFolderLimit] Max folders allowed:', maxFolders);
        console.log('[checkFolderLimit] Current folder count:', usage.totalFolders);
        // Check if limit reached (-1 means unlimited)
        if (maxFolders !== -1 && usage.totalFolders >= maxFolders) {
            console.log('[checkFolderLimit] Folder limit reached!');
            return res.status(403).json({
                success: false,
                message: `You've reached your folder limit (${maxFolders} folders). Upgrade your plan to create more folders and organize your spaces better.`,
                code: "FOLDER_LIMIT_REACHED",
                currentCount: usage.totalFolders,
                maxAllowed: maxFolders,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "folders"
            });
        }
        console.log('[checkFolderLimit] Limit check passed, proceeding');
        next();
    }
    catch (error) {
        console.error("[Folder Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking folder limit"
        });
    }
};
/**
 * Check custom table creation limit based on plan (GLOBAL across all workspaces owned by workspace owner)
 */
const checkTableLimit = async (req, res, next) => {
    try {
        console.log('[checkTableLimit] Starting table limit check');
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            console.log('[checkTableLimit] Super user detected, bypassing limit');
            return next();
        }
        // Get space ID from params
        const spaceId = req.params?.spaceId;
        console.log('[checkTableLimit] Space ID:', spaceId);
        if (!spaceId) {
            console.log('[checkTableLimit] No space ID found');
            return res.status(400).json({
                success: false,
                message: "Space ID required"
            });
        }
        // Get space to find workspace
        const Space = require("../models/Space");
        const space = await Space.findById(spaceId).select('workspace').lean();
        if (!space) {
            console.log('[checkTableLimit] Space not found');
            return res.status(404).json({
                success: false,
                message: "Space not found"
            });
        }
        console.log('[checkTableLimit] Found space, workspace ID:', space.workspace);
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString());
        console.log('[checkTableLimit] Workspace owner ID:', ownerId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            console.log('[checkTableLimit] Owner not found');
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        console.log('[checkTableLimit] Current usage:', usage);
        // Get plan limits from OWNER's subscription
        let maxTables = 0; // Fallback if no plan found
        let canCreateTables = false;
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan with inheritance resolution
            const plan = owner.subscription.planId;
            const PlanInheritanceService = require("../services/planInheritanceService").default;
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            canCreateTables = resolvedFeatures.canCreateTables ?? false;
            maxTables = resolvedFeatures.maxTablesCount ?? 0;
            planName = plan.name;
            console.log('[checkTableLimit] Paid plan found:', planName, 'canCreateTables:', canCreateTables, 'maxTables:', maxTables);
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                canCreateTables = freePlan.features?.canCreateTables ?? false;
                maxTables = freePlan.features?.maxTablesCount ?? 0;
                planName = freePlan.name;
                console.log('[checkTableLimit] Free plan found in database:', planName, 'canCreateTables:', canCreateTables, 'maxTables:', maxTables);
            }
            else {
                console.log('[checkTableLimit] No plan found, using hardcoded fallback');
            }
        }
        // Check if feature is enabled
        if (!canCreateTables) {
            console.log('[checkTableLimit] Custom tables feature not enabled');
            return res.status(403).json({
                success: false,
                message: "Custom tables are not available in your current plan. Upgrade to Pro or Enterprise to unlock this feature.",
                code: "TABLES_FEATURE_UNAVAILABLE",
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "tables"
            });
        }
        console.log('[checkTableLimit] Max tables allowed:', maxTables);
        console.log('[checkTableLimit] Current table count:', usage.totalTables);
        // Check if limit reached (-1 means unlimited)
        if (maxTables !== -1 && usage.totalTables >= maxTables) {
            console.log('[checkTableLimit] Table limit reached!');
            return res.status(403).json({
                success: false,
                message: `You've reached your table limit (${maxTables} tables). Upgrade your plan to create more tables and organize your data better.`,
                code: "TABLE_LIMIT_REACHED",
                currentCount: usage.totalTables,
                maxAllowed: maxTables,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "tables"
            });
        }
        console.log('[checkTableLimit] Limit check passed, proceeding');
        next();
    }
    catch (error) {
        console.error("[Table Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking table limit"
        });
    }
};
const checkRowLimit = async (req, res, next) => {
    try {
        console.log('[checkRowLimit] Starting row limit check');
        // Super users bypass all limits
        if (req.user?.isSuperUser) {
            console.log('[checkRowLimit] Super user detected, bypassing limit');
            return next();
        }
        // Get table ID from params
        const tableId = req.params?.tableId;
        console.log('[checkRowLimit] Table ID:', tableId);
        if (!tableId) {
            console.log('[checkRowLimit] No table ID found');
            return res.status(400).json({
                success: false,
                message: "Table ID required"
            });
        }
        // Get table to find space and workspace
        const CustomTable = require("../models/CustomTable");
        const table = await CustomTable.findById(tableId).select('spaceId').lean();
        if (!table) {
            console.log('[checkRowLimit] Table not found');
            return res.status(404).json({
                success: false,
                message: "Table not found"
            });
        }
        // Get space to find workspace
        const Space = require("../models/Space");
        const space = await Space.findById(table.spaceId).select('workspace').lean();
        if (!space) {
            console.log('[checkRowLimit] Space not found');
            return res.status(404).json({
                success: false,
                message: "Space not found"
            });
        }
        console.log('[checkRowLimit] Found space, workspace ID:', space.workspace);
        // Get workspace owner
        const ownerId = await entitlementService_1.default.getWorkspaceOwner(space.workspace.toString());
        console.log('[checkRowLimit] Workspace owner ID:', ownerId);
        // Get owner's subscription
        const owner = await User.findById(ownerId).populate('subscription.planId');
        if (!owner) {
            console.log('[checkRowLimit] Owner not found');
            return res.status(404).json({
                success: false,
                message: "Workspace owner not found"
            });
        }
        // Get GLOBAL usage for the workspace owner
        const usage = await entitlementService_1.default.getTotalUsage(ownerId);
        console.log('[checkRowLimit] Current usage:', usage);
        // Get plan limits from OWNER's subscription
        let maxRows = 0; // Fallback if no plan found
        let planName = 'Free (Default)';
        if (owner.subscription?.isPaid && owner.subscription.planId) {
            // Paid user - use their plan
            const plan = owner.subscription.planId;
            maxRows = plan.features?.maxRowsLimit ?? 0;
            planName = plan.name;
            console.log('[checkRowLimit] Paid plan found:', planName, 'maxRows:', maxRows);
        }
        else {
            // Free user - try to find a free plan in database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                maxRows = freePlan.features?.maxRowsLimit ?? 0;
                planName = freePlan.name;
                console.log('[checkRowLimit] Free plan found in database:', planName, 'maxRows:', maxRows);
            }
            else {
                console.log('[checkRowLimit] No plan found, using hardcoded fallback');
            }
        }
        console.log('[checkRowLimit] Max rows allowed:', maxRows);
        console.log('[checkRowLimit] Current row count:', usage.totalRows);
        // Check if limit reached (-1 or 0 means unlimited)
        if (maxRows > 0 && usage.totalRows >= maxRows) {
            console.log('[checkRowLimit] Row limit reached!');
            return res.status(403).json({
                success: false,
                message: `You've reached your row limit (${maxRows} rows). Upgrade your plan to add more rows to your tables.`,
                code: "ROW_LIMIT_REACHED",
                currentCount: usage.totalRows,
                maxAllowed: maxRows,
                isPaid: owner.subscription?.isPaid || false,
                action: "upgrade",
                feature: "rows"
            });
        }
        console.log('[checkRowLimit] Limit check passed, proceeding');
        next();
    }
    catch (error) {
        console.error("[Row Limit] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking row limit"
        });
    }
};
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
        const usage = await entitlementService_1.default.getTotalUsage(userId);
        // Get plan details
        let planDetails = null;
        if (user.subscription?.isPaid && user.subscription.planId) {
            // Paid user - use their assigned plan
            planDetails = user.subscription.planId;
        }
        else {
            // Free user - fetch free plan from database
            const Plan = require("../models/Plan");
            const freePlan = await Plan.findOne({
                name: { $regex: /free/i },
                isActive: true
            }).lean();
            if (freePlan) {
                planDetails = freePlan;
            }
        }
        console.log('[getSubscriptionInfo] User subscription data:', {
            isPaid: user.subscription?.isPaid,
            memberCount: user.subscription?.memberCount,
            billingCycle: user.subscription?.billingCycle,
            status: user.subscription?.status
        });
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
                plan: planDetails ? {
                    _id: planDetails._id,
                    name: planDetails.name,
                    price: planDetails.price,
                    features: planDetails.features
                } : null,
                usage: {
                    workspaces: usage.totalWorkspaces,
                    spaces: usage.totalSpaces,
                    lists: usage.totalLists,
                    folders: usage.totalFolders,
                    tasks: usage.totalTasks
                }
            }
        });
    }
    catch (error) {
        console.error("[Get Subscription Info] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching subscription info"
        });
    }
};
module.exports = {
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
