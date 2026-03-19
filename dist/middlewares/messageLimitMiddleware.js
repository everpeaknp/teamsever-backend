"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const ChatMessage = require("../models/ChatMessage");
const AppError = require("../utils/AppError");
/**
 * Check message limit for a workspace (reusable function)
 * Returns { allowed: boolean, error?: object, usage?: object }
 */
const checkMessageLimitForWorkspace = async (workspaceId) => {
    try {
        console.log('[MessageLimit] Checking message limit for workspace:', workspaceId);
        // Get workspace with owner
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        }).lean();
        if (!workspace) {
            return {
                allowed: false,
                error: {
                    message: "Workspace not found",
                    code: "WORKSPACE_NOT_FOUND"
                }
            };
        }
        // Get workspace owner with subscription
        const owner = await User.findById(workspace.owner).populate('subscription.planId');
        if (!owner) {
            return {
                allowed: false,
                error: {
                    message: "Workspace owner not found",
                    code: "OWNER_NOT_FOUND"
                }
            };
        }
        console.log('[MessageLimit] Owner subscription:', owner.subscription);
        // Get owner's plan
        const plan = owner.subscription?.planId;
        if (!plan) {
            console.log('[MessageLimit] No plan found, using free tier limits');
            // Free tier - no group chat
            return {
                allowed: false,
                error: {
                    message: "Group chat is not available on the free plan",
                    code: "GROUP_CHAT_DISABLED",
                    action: "upgrade",
                    feature: "group_chat"
                }
            };
        }
        console.log('[MessageLimit] Plan:', plan.name, 'Features:', plan.features);
        // Check if group chat is enabled
        if (!plan.features.hasGroupChat) {
            console.log('[MessageLimit] Group chat not enabled in plan');
            return {
                allowed: false,
                error: {
                    message: `Group chat is not available in the ${plan.name} plan`,
                    code: "GROUP_CHAT_DISABLED",
                    action: "upgrade",
                    feature: "group_chat"
                }
            };
        }
        // Check message limit
        const messageLimit = plan.features.messageLimit;
        console.log('[MessageLimit] Message limit:', messageLimit);
        // -1 means unlimited
        if (messageLimit === -1) {
            console.log('[MessageLimit] Unlimited messages, allowing');
            return {
                allowed: true,
                usage: {
                    current: 0,
                    limit: -1,
                    remaining: -1
                }
            };
        }
        // Count messages sent this month across ALL workspaces owned by this user
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        console.log('[MessageLimit] Counting messages since:', startOfMonth);
        // Get all workspaces owned by this user
        const ownedWorkspaces = await Workspace.find({
            owner: owner._id,
            isDeleted: false
        }).select('_id').lean();
        const workspaceIds = ownedWorkspaces.map(w => w._id);
        console.log('[MessageLimit] Owner has', workspaceIds.length, 'workspaces');
        // Count messages across all owned workspaces this month
        const messageCount = await ChatMessage.countDocuments({
            workspace: { $in: workspaceIds },
            createdAt: { $gte: startOfMonth },
            isDeleted: false
        });
        console.log('[MessageLimit] Messages used this month:', messageCount, '/', messageLimit);
        // Check if limit exceeded
        if (messageCount >= messageLimit) {
            console.log('[MessageLimit] Message limit exceeded');
            return {
                allowed: false,
                error: {
                    message: `Monthly message limit reached (${messageLimit} messages)`,
                    code: "MESSAGE_LIMIT_EXCEEDED",
                    action: "upgrade",
                    feature: "messages",
                    usage: {
                        current: messageCount,
                        limit: messageLimit,
                        remaining: 0
                    }
                }
            };
        }
        console.log('[MessageLimit] Check passed, remaining:', messageLimit - messageCount);
        return {
            allowed: true,
            usage: {
                current: messageCount,
                limit: messageLimit,
                remaining: messageLimit - messageCount
            }
        };
    }
    catch (error) {
        console.error('[MessageLimit] Error:', error);
        return {
            allowed: false,
            error: {
                message: "Error checking message limit",
                code: "INTERNAL_ERROR"
            }
        };
    }
};
/**
 * Express middleware to check message limit
 */
const checkMessageLimit = async (req, res, next) => {
    try {
        const { workspaceId } = req.params;
        const result = await checkMessageLimitForWorkspace(workspaceId);
        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                ...result.error
            });
        }
        // Add usage info to request
        req.messageUsage = result.usage;
        next();
    }
    catch (error) {
        console.error('[MessageLimit] Middleware error:', error);
        next(error);
    }
};
module.exports = { checkMessageLimit, checkMessageLimitForWorkspace };
