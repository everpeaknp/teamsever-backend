"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Workspace = require('../models/Workspace');
const Space = require('../models/Space');
const List = require('../models/List');
const Folder = require('../models/Folder');
const Task = require('../models/Task');
const CustomTable = require('../models/CustomTable');
const User = require('../models/User');
const Plan = require('../models/Plan');
const PlanInheritanceService = require('./planInheritanceService').default;
const usageCache = new Map();
const entitlementCache = new Map();
/**
 * EntitlementService
 * Calculates global usage across all workspaces owned by a user
 */
class EntitlementService {
    /**
     * Get total usage across all workspaces owned by a user
     * @param ownerId - The owner's user ID
     * @returns Total usage counts
     */
    async getTotalUsage(ownerId) {
        try {
            console.log(`[EntitlementService] Calculating total usage for owner: ${ownerId}`);
            // Check cache first
            const cacheKey = `usage:${ownerId}`;
            const cached = usageCache.get(cacheKey);
            if (cached && Date.now() < cached.expires) {
                console.log(`[EntitlementService] Returning cached usage for owner ${ownerId}`);
                return cached.usage;
            }
            // Use aggregation pipeline to calculate all usage in 1-2 queries
            // Query 1: Get workspace-level counts (workspaces, spaces, lists, tasks)
            const workspaceAggregation = await Workspace.aggregate([
                {
                    // Match workspaces owned by this user
                    $match: {
                        owner: new mongoose_1.default.Types.ObjectId(ownerId),
                        isDeleted: false
                    }
                },
                {
                    // Lookup spaces for these workspaces
                    $lookup: {
                        from: 'spaces',
                        let: { workspaceId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$workspace', '$$workspaceId'] },
                                            { $eq: ['$isDeleted', false] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'spaces'
                    }
                },
                {
                    // Lookup lists for these workspaces
                    $lookup: {
                        from: 'lists',
                        let: { workspaceId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$workspace', '$$workspaceId'] },
                                            { $eq: ['$isDeleted', false] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'lists'
                    }
                },
                {
                    // Lookup tasks for these workspaces
                    $lookup: {
                        from: 'tasks',
                        let: { workspaceId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$workspace', '$$workspaceId'] },
                                            { $eq: ['$isDeleted', false] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'tasks'
                    }
                },
                {
                    // Project to calculate sizes
                    $project: {
                        spaceCount: { $size: '$spaces' },
                        listCount: { $size: '$lists' },
                        taskCount: { $size: '$tasks' },
                        spaceIds: '$spaces._id'
                    }
                },
                {
                    // Group to get totals
                    $group: {
                        _id: null,
                        totalWorkspaces: { $sum: 1 },
                        totalSpaces: { $sum: '$spaceCount' },
                        totalLists: { $sum: '$listCount' },
                        totalTasks: { $sum: '$taskCount' },
                        allSpaceIds: { $push: '$spaceIds' }
                    }
                }
            ]);
            // If no workspaces, return zeros
            if (workspaceAggregation.length === 0) {
                const usage = {
                    totalWorkspaces: 0,
                    totalSpaces: 0,
                    totalLists: 0,
                    totalFolders: 0,
                    totalTasks: 0,
                    totalTables: 0,
                    totalRows: 0
                };
                // Cache the result
                usageCache.set(cacheKey, {
                    usage,
                    expires: Date.now() + 5 * 60 * 1000 // 5 minutes
                });
                return usage;
            }
            const workspaceResult = workspaceAggregation[0];
            // Flatten the array of space ID arrays
            const spaceIds = workspaceResult.allSpaceIds.flat();
            // Query 2: Get space-level counts (folders, tables, rows)
            let totalFolders = 0;
            let totalTables = 0;
            let totalRows = 0;
            if (spaceIds.length > 0) {
                const spaceAggregation = await Space.aggregate([
                    {
                        // Match spaces by IDs
                        $match: {
                            _id: { $in: spaceIds }
                        }
                    },
                    {
                        // Lookup folders for these spaces
                        $lookup: {
                            from: 'folders',
                            let: { spaceId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$spaceId', '$$spaceId'] },
                                                { $eq: ['$isDeleted', false] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'folders'
                        }
                    },
                    {
                        // Lookup tables for these spaces
                        $lookup: {
                            from: 'customtables',
                            let: { spaceId: '$_id' },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ['$spaceId', '$$spaceId'] },
                                                { $eq: ['$isDeleted', false] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: 'tables'
                        }
                    },
                    {
                        // Project to calculate sizes and row counts
                        $project: {
                            folderCount: { $size: '$folders' },
                            tableCount: { $size: '$tables' },
                            rowCount: {
                                $sum: {
                                    $map: {
                                        input: '$tables',
                                        as: 'table',
                                        in: { $size: '$$table.rows' }
                                    }
                                }
                            }
                        }
                    },
                    {
                        // Group to get totals
                        $group: {
                            _id: null,
                            totalFolders: { $sum: '$folderCount' },
                            totalTables: { $sum: '$tableCount' },
                            totalRows: { $sum: '$rowCount' }
                        }
                    }
                ]);
                if (spaceAggregation.length > 0) {
                    totalFolders = spaceAggregation[0].totalFolders;
                    totalTables = spaceAggregation[0].totalTables;
                    totalRows = spaceAggregation[0].totalRows;
                }
            }
            const usage = {
                totalWorkspaces: workspaceResult.totalWorkspaces,
                totalSpaces: workspaceResult.totalSpaces,
                totalLists: workspaceResult.totalLists,
                totalFolders,
                totalTasks: workspaceResult.totalTasks,
                totalTables,
                totalRows
            };
            console.log(`[EntitlementService] Total usage for owner ${ownerId}:`, usage);
            // Cache the result for 5 minutes
            usageCache.set(cacheKey, {
                usage,
                expires: Date.now() + 5 * 60 * 1000 // 5 minutes
            });
            return usage;
        }
        catch (error) {
            console.error(`[EntitlementService] Error calculating total usage:`, error);
            throw error;
        }
    }
    /**
     * Get workspace owner's ID
     * @param workspaceId - The workspace ID
     * @returns Owner's user ID
     */
    async getWorkspaceOwner(workspaceId) {
        try {
            const workspace = await Workspace.findById(workspaceId).select('owner').lean();
            if (!workspace) {
                throw new Error('Workspace not found');
            }
            return workspace.owner.toString();
        }
        catch (error) {
            console.error(`[EntitlementService] Error getting workspace owner:`, error);
            throw error;
        }
    }
    /**
     * Invalidate usage cache for a specific owner
     * @param ownerId - The owner's user ID
     */
    invalidateUsageCache(ownerId) {
        const cacheKey = `usage:${ownerId}`;
        usageCache.delete(cacheKey);
        console.log(`[EntitlementService] Invalidated usage cache for owner ${ownerId}`);
    }
    /**
     * Invalidate entitlement cache for a specific user
     * This should be called when a user's plan changes
     * @param userId - The user's ID
     */
    invalidateEntitlementCache(userId) {
        // Clear all entitlement cache entries for this user
        const keysToDelete = [];
        entitlementCache.forEach((_, key) => {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => entitlementCache.delete(key));
        console.log(`[EntitlementService] Invalidated entitlement cache for user ${userId} (${keysToDelete.length} entries)`);
    }
    /**
     * Get user's subscription plan with inheritance resolved
     * @param userId - The user's ID
     * @returns Resolved plan features or null if no plan
     */
    async getUserPlan(userId) {
        try {
            const user = await User.findById(userId).populate('subscription.planId');
            if (!user || !user.subscription?.planId) {
                // Return free plan
                const freePlan = await Plan.findOne({ name: 'Free' });
                return freePlan;
            }
            return user.subscription.planId;
        }
        catch (error) {
            console.error(`[EntitlementService] Error getting user plan:`, error);
            throw error;
        }
    }
    /**
     * Check if user can use custom roles feature
     * This checks the workspace owner's plan, not the user's plan
     * @param userId - The workspace owner's ID
     * @returns Object with allowed status and optional reason
     */
    async canUseCustomRoles(userId) {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            // Resolve features with inheritance
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const canUse = resolvedFeatures.canUseCustomRoles || false;
            if (!canUse) {
                return {
                    allowed: false,
                    reason: 'Custom roles feature is not available in your current plan'
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking custom roles entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can use custom roles feature in a specific workspace
     * This checks the workspace owner's plan
     * @param workspaceId - The workspace ID
     * @returns Object with allowed status and optional reason
     */
    async canUseCustomRolesInWorkspace(workspaceId) {
        try {
            const ownerId = await this.getWorkspaceOwner(workspaceId);
            return await this.canUseCustomRoles(ownerId);
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking custom roles entitlement for workspace:`, error);
            throw error;
        }
    }
    /**
     * Check if user can create a new table
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canCreateTable(userId) {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            // Resolve features with inheritance
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            // Check if feature is enabled
            const canCreate = resolvedFeatures.canCreateTables || false;
            if (!canCreate) {
                return {
                    allowed: false,
                    reason: 'Custom tables feature is not available in your current plan'
                };
            }
            // Check table count limit
            const maxTables = resolvedFeatures.maxTablesCount;
            // -1 means unlimited
            if (maxTables === -1) {
                return { allowed: true };
            }
            // undefined/null means feature not configured, default to unlimited
            if (maxTables === undefined || maxTables === null) {
                return { allowed: true };
            }
            // Get current usage
            const usage = await this.getTotalUsage(userId);
            if (usage.totalTables >= maxTables) {
                return {
                    allowed: false,
                    reason: `Table limit reached (${usage.totalTables}/${maxTables})`
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking table creation entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can add a new row
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canAddRow(userId) {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            // Resolve features with inheritance
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            // Check row limit
            const maxRows = resolvedFeatures.maxRowsLimit;
            // -1 means unlimited, 0 means no limit set
            if (maxRows === -1 || maxRows === 0 || maxRows === undefined || maxRows === null) {
                return { allowed: true };
            }
            // Get current usage
            const usage = await this.getTotalUsage(userId);
            if (usage.totalRows >= maxRows) {
                return {
                    allowed: false,
                    reason: `Row limit reached (${usage.totalRows}/${maxRows})`
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking row addition entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can add a new column
     * @param userId - The user's ID
     * @param tableId - The table ID to check column count for
     * @returns Object with allowed status and optional reason
     */
    async canAddColumn(userId, tableId) {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            // Resolve features with inheritance
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            // Check column limit
            const maxColumns = resolvedFeatures.maxColumnsLimit;
            // -1 means unlimited, 0 means no limit set
            if (maxColumns === -1 || maxColumns === 0 || maxColumns === undefined || maxColumns === null) {
                return { allowed: true };
            }
            // Get current column count for this table
            const CustomTable = require('../models/CustomTable');
            const table = await CustomTable.findById(tableId);
            if (!table) {
                return { allowed: false, reason: 'Table not found' };
            }
            const currentColumns = table.columns?.length || 0;
            if (currentColumns >= maxColumns) {
                return {
                    allowed: false,
                    reason: `Column limit reached (${currentColumns}/${maxColumns})`
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking column addition entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can upload a new file
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canUploadFile(userId) {
        try {
            console.log(`[EntitlementService] canUploadFile called for user: ${userId}`);
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                console.log(`[EntitlementService] No plan found for user: ${userId}`);
                return { allowed: false, reason: 'No subscription plan found' };
            }
            console.log(`[EntitlementService] User plan:`, plan.name);
            console.log(`[EntitlementService] Raw plan features:`, JSON.stringify(plan.features, null, 2));
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            console.log(`[EntitlementService] Resolved features:`, JSON.stringify(resolvedFeatures, null, 2));
            const maxFiles = resolvedFeatures.maxFiles;
            console.log(`[EntitlementService] Max files allowed: ${maxFiles}`);
            // -1 means unlimited
            if (maxFiles === -1) {
                console.log(`[EntitlementService] Unlimited files allowed`);
                return { allowed: true };
            }
            // 0 or undefined/null means feature not configured, default to unlimited
            if (maxFiles === undefined || maxFiles === null) {
                console.log(`[EntitlementService] No file limit configured, allowing upload`);
                return { allowed: true };
            }
            // Count files across all workspaces owned by user
            const WorkspaceFile = require('../models/WorkspaceFile');
            const workspaces = await Workspace.find({ owner: userId, isDeleted: false }).select('_id');
            const workspaceIds = workspaces.map((w) => w._id);
            console.log(`[EntitlementService] User owns ${workspaces.length} workspaces`);
            const fileCount = await WorkspaceFile.countDocuments({
                workspace: { $in: workspaceIds },
                isDeleted: false
            });
            console.log(`[EntitlementService] Current file count: ${fileCount}, Max: ${maxFiles}`);
            if (fileCount >= maxFiles) {
                console.log(`[EntitlementService] File limit reached!`);
                return {
                    allowed: false,
                    reason: `File limit reached (${fileCount}/${maxFiles})`
                };
            }
            else {
                console.log(`[EntitlementService] Upload allowed (${fileCount}/${maxFiles})`);
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking file upload entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can create a new document
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canCreateDocument(userId) {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const maxDocuments = resolvedFeatures.maxDocuments;
            // -1 means unlimited
            if (maxDocuments === -1) {
                return { allowed: true };
            }
            // undefined/null means feature not configured, default to unlimited
            if (maxDocuments === undefined || maxDocuments === null) {
                return { allowed: true };
            }
            // Count documents in workspaces owned by user
            const Document = require('../models/Document');
            const workspaces = await Workspace.find({ owner: userId, isDeleted: false }).select('_id');
            const workspaceIds = workspaces.map((w) => w._id);
            const documentCount = await Document.countDocuments({
                workspace: { $in: workspaceIds },
                isArchived: false
            });
            if (documentCount >= maxDocuments) {
                return {
                    allowed: false,
                    reason: `Document limit reached (${documentCount}/${maxDocuments})`
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking document creation entitlement:`, error);
            throw error;
        }
    }
    /**
     * Check if user can send a direct message to another user
     * @param senderId - The sender's user ID
     * @param recipientId - The recipient's user ID
     * @returns Object with allowed status and optional reason
     */
    async canSendDirectMessage(senderId, recipientId) {
        try {
            const plan = await this.getUserPlan(senderId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const maxMessagesPerUser = resolvedFeatures.maxDirectMessagesPerUser;
            // -1 means unlimited
            if (maxMessagesPerUser === -1) {
                return { allowed: true };
            }
            // undefined/null means feature not configured, default to unlimited
            if (maxMessagesPerUser === undefined || maxMessagesPerUser === null) {
                return { allowed: true };
            }
            // Find conversation between sender and recipient
            const Conversation = require('../models/Conversation');
            const DirectMessage = require('../models/DirectMessage');
            // Sort participants for consistent ordering (same as service does)
            const participants = [senderId, recipientId].sort();
            const conversation = await Conversation.findOne({
                participants: { $all: participants }
            });
            let messageCount = 0;
            if (conversation) {
                // Count messages sent by sender in this conversation
                messageCount = await DirectMessage.countDocuments({
                    conversation: conversation._id,
                    sender: senderId
                });
            }
            // If no conversation exists, messageCount stays 0 (first message)
            if (messageCount >= maxMessagesPerUser) {
                return {
                    allowed: false,
                    reason: `Direct message limit reached (${messageCount}/${maxMessagesPerUser} messages to this user)`
                };
            }
            else {
                return { allowed: true };
            }
        }
        catch (error) {
            console.error(`[EntitlementService] Error checking direct message entitlement:`, error);
            throw error;
        }
    }
}
exports.default = new EntitlementService();
