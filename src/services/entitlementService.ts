import mongoose from 'mongoose';

const Workspace = require('../models/Workspace');
const Space = require('../models/Space');
const List = require('../models/List');
const Folder = require('../models/Folder');
const Task = require('../models/Task');
const CustomTable = require('../models/CustomTable');
const User = require('../models/User');
const Plan = require('../models/Plan');
const WorkspaceFile = require('../models/WorkspaceFile');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const DirectMessage = require('../models/DirectMessage');
const ChatChannel = require('../models/ChatChannel');

const PlanInheritanceService = require('./planInheritanceService').default;

interface TotalUsage {
    totalWorkspaces: number;
    totalSpaces: number;
    totalLists: number;
    totalFolders: number;
    totalTasks: number;
    totalTables: number;
    totalRows: number;
    totalPrivateChannels: number;
}

// Cache for usage calculations (5-minute TTL)
interface CacheEntry {
    usage: TotalUsage;
    expires: number;
}

// Cache for entitlement checks (5-minute TTL)
interface EntitlementCacheEntry {
    result: { allowed: boolean; reason?: string };
    expires: number;
}

const usageCache = new Map<string, CacheEntry>();
const entitlementCache = new Map<string, EntitlementCacheEntry>();

const SUPER_PLAN_FEATURES = {
    maxWorkspaces: -1,
    maxAdmins: -1,
    maxSpaces: -1,
    maxLists: -1,
    maxFolders: -1,
    maxTasks: -1,
    hasAccessControl: true,
    hasGroupChat: true,
    messageLimit: -1,
    announcementCooldown: 0,
    accessControlTier: 'advanced',
    canUseCustomRoles: true,
    maxCustomRoles: -1,
    canCreateTables: true,
    maxTablesCount: -1,
    maxRowsLimit: -1,
    maxColumnsLimit: -1,
    maxFiles: -1,
    maxDocuments: -1,
    maxDirectMessagesPerUser: -1,
    canCreatePrivateChannels: true,
    maxPrivateChannelsCount: -1,
    maxMembersPerPrivateChannel: -1
};

const DEFAULT_FREE_FEATURES = {
    maxWorkspaces: 1,
    maxAdmins: 1,
    maxSpaces: 10,
    maxLists: 50,
    maxFolders: 20,
    maxTasks: 100,
    hasAccessControl: false,
    hasGroupChat: false,
    messageLimit: 100,
    announcementCooldown: 24,
    accessControlTier: 'basic',
    canUseCustomRoles: false,
    maxCustomRoles: 0,
    canCreateTables: false,
    maxTablesCount: 0,
    maxRowsLimit: 0,
    maxColumnsLimit: 0,
    maxFiles: 5,
    maxDocuments: 5,
    maxDirectMessagesPerUser: 50,
    canCreatePrivateChannels: false,
    maxPrivateChannelsCount: 0,
    maxMembersPerPrivateChannel: 0
};

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
    async getTotalUsage(ownerId: string): Promise<TotalUsage> {
        try {
            // Check cache first
            const cacheKey = `usage:${ownerId}`;
            const cached = usageCache.get(cacheKey);
            if (cached && Date.now() < cached.expires) {
                return cached.usage;
            }

            // Use aggregation pipeline to calculate all usage in 1-2 queries
            // Query 1: Get workspace-level counts (workspaces, spaces, lists, tasks)
            const workspaceAggregation = await Workspace.aggregate([
                {
                    // Match workspaces owned by this user
                    $match: {
                        owner: new mongoose.Types.ObjectId(ownerId),
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

            // Query 1b: Get private channel count for these workspaces
            const workspaces = await Workspace.find({ owner: ownerId, isDeleted: false }).select('_id');
            const workspaceIds = workspaces.map((w: any) => w._id);
            const totalPrivateChannels = await ChatChannel.countDocuments({
                workspace: { $in: workspaceIds },
                type: 'private',
                isDeleted: false
            });

            // If no workspaces, return zeros
            if (workspaceAggregation.length === 0) {
                const usage: TotalUsage = {
                    totalWorkspaces: 0,
                    totalSpaces: 0,
                    totalLists: 0,
                    totalFolders: 0,
                    totalTasks: 0,
                    totalTables: 0,
                    totalRows: 0,
                    totalPrivateChannels: 0
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

            const usage: TotalUsage = {
                totalWorkspaces: workspaceResult.totalWorkspaces,
                totalSpaces: workspaceResult.totalSpaces,
                totalLists: workspaceResult.totalLists,
                totalFolders,
                totalTasks: workspaceResult.totalTasks,
                totalTables,
                totalRows,
                totalPrivateChannels
            };

            // Cache the result for 5 minutes
            usageCache.set(cacheKey, {
                usage,
                expires: Date.now() + 5 * 60 * 1000 // 5 minutes
            });

            return usage;
        } catch (error) {
            console.error(`[EntitlementService] Error calculating total usage:`, error);
            throw error;
        }
    }

    /**
     * Get workspace owner's ID
     * @param workspaceId - The workspace ID
     * @returns Owner's user ID
     */
    async getWorkspaceOwner(workspaceId: string): Promise<string> {
        try {
            const workspace = await Workspace.findById(workspaceId).select('owner').lean();
            if (!workspace) {
                throw new Error('Workspace not found');
            }
            return workspace.owner.toString();
        } catch (error) {
            console.error(`[EntitlementService] Error getting workspace owner:`, error);
            throw error;
        }
    }

    /**
     * Invalidate usage cache for a specific owner
     * @param ownerId - The owner's user ID
     */
    invalidateUsageCache(ownerId: string): void {
        const cacheKey = `usage:${ownerId}`;
        usageCache.delete(cacheKey);
    }

    /**
     * Invalidate entitlement cache for a specific user
     * This should be called when a user's plan changes
     * @param userId - The user's ID
     */
    invalidateEntitlementCache(userId: string): void {
        // Clear all entitlement cache entries for this user
        const keysToDelete: string[] = [];
        entitlementCache.forEach((_, key) => {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => entitlementCache.delete(key));
    }

    /**
     * Get user's subscription plan with inheritance resolved
     * @param userId - The user's ID
     * @returns Resolved plan features or null if no plan
     */
    async getUserPlan(userId: string): Promise<any> {
        try {
            const user = await User.findById(userId).populate('subscription.planId');
            
            // SUPER ADMIN BYPASS: Grant unlimited access
            if (user && user.isSuperUser) {
                return {
                    name: 'Super Admin Unlimited',
                    features: SUPER_PLAN_FEATURES
                };
            }

            if (!user || !user.subscription?.planId) {
                // Try to find a FREE plan
                const freePlan = await Plan.findOne({ 
                    $or: [{ name: /Free/i }, { name: 'Basic' }, { isActive: true }] 
                }).sort({ pricePerMemberMonthly: 1 });
                
                if (freePlan) {
                    return freePlan;
                }

                // If absolutely no plan found in DB, return a virtual free plan
                return {
                    name: 'Default Free',
                    features: DEFAULT_FREE_FEATURES
                };
            }

            const plan = JSON.parse(JSON.stringify(user.subscription.planId));
            
            // Merge feature overrides if they exist
            if (user.subscription.featureOverrides) {
                const overrides = user.subscription.featureOverrides.toObject ? user.subscription.featureOverrides.toObject() : user.subscription.featureOverrides;
                if (!plan.features) plan.features = {};
                
                Object.keys(overrides).forEach(key => {
                    const value = overrides[key];
                    if (value !== undefined && value !== null) {
                        plan.features[key] = value;
                    }
                });
            }

            return plan;
        } catch (error) {
            console.error(`[EntitlementService] Error getting user plan:`, error);
            // Defensive fallback
            return {
                name: 'Error Fallback',
                features: DEFAULT_FREE_FEATURES
            };
        }
    }

    /**
     * Check if user can use custom roles feature
     * This checks the workspace owner's plan, not the user's plan
     * @param userId - The workspace owner's ID
     * @returns Object with allowed status and optional reason
     */
    async canUseCustomRoles(userId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            } else {
                return { allowed: true };
            }
        } catch (error) {
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
    async canUseCustomRolesInWorkspace(workspaceId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const ownerId = await this.getWorkspaceOwner(workspaceId);
            return await this.canUseCustomRoles(ownerId);
        } catch (error) {
            console.error(`[EntitlementService] Error checking custom roles entitlement for workspace:`, error);
            throw error;
        }
    }

    /**
     * Check if user can create a new table
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canCreateTable(userId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            } else {
                return { allowed: true };
            }
        } catch (error) {
            console.error(`[EntitlementService] Error checking table creation entitlement:`, error);
            throw error;
        }
    }

    /**
     * Check if user can add a new row
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canAddRow(userId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            } else {
                return { allowed: true };
            }
        } catch (error) {
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
    async canAddColumn(userId: string, tableId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            } else {
                return { allowed: true };
            }
        } catch (error) {
            console.error(`[EntitlementService] Error checking column addition entitlement:`, error);
            throw error;
        }
    }

    /**
     * Check if user can upload a new file
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canUploadFile(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }

            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const maxFiles = resolvedFeatures.maxFiles;
            
            // -1 means unlimited
            if (maxFiles === -1) {
                return { allowed: true };
            }
            
            // 0 or undefined/null means feature not configured, default to unlimited
            if (maxFiles === undefined || maxFiles === null) {
                return { allowed: true };
            }

            // Count files across all workspaces owned by user
            const workspaces = await Workspace.find({ owner: userId, isDeleted: false }).select('_id');
            const workspaceIds = workspaces.map((w: any) => w._id);
            
            const fileCount = await WorkspaceFile.countDocuments({
                workspace: { $in: workspaceIds },
                isDeleted: false
            });

            if (fileCount >= maxFiles) {
                return { 
                    allowed: false, 
                    reason: `File limit reached (${fileCount}/${maxFiles})` 
                };
            } else {
                return { allowed: true };
            }
        } catch (error) {
            console.error(`[EntitlementService] Error checking file upload entitlement:`, error);
            throw error;
        }
    }

    /**
     * Check if user can create a new document
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canCreateDocument(userId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            const workspaces = await Workspace.find({ owner: userId, isDeleted: false }).select('_id');
            const workspaceIds = workspaces.map((w: any) => w._id);
            
            const documentCount = await Document.countDocuments({
                workspace: { $in: workspaceIds },
                isArchived: false
            });

            if (documentCount >= maxDocuments) {
                return { 
                    allowed: false, 
                    reason: `Document limit reached (${documentCount}/${maxDocuments})` 
                };
            } else {
                return { allowed: true };
            }
        } catch (error) {
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
    async canSendDirectMessage(senderId: string, recipientId: string): Promise<{ allowed: boolean; reason?: string }> {
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
            } else {
                return { allowed: true };
            }
        } catch (error) {
            console.error(`[EntitlementService] Error checking direct message entitlement:`, error);
            throw error;
        }
    }
    
    /**
     * Check if user can create a new private channel
     * @param userId - The user's ID
     * @returns Object with allowed status and optional reason
     */
    async canCreatePrivateChannel(userId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) {
                return { allowed: false, reason: 'No subscription plan found' };
            }

            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            
            // Check if feature is enabled
            if (!resolvedFeatures.canCreatePrivateChannels) {
                return { 
                    allowed: false, 
                    reason: 'Private groups are not available in your current plan. Upgrade to unlock private team discussions.' 
                };
            }

            // Check count limit
            const maxCount = resolvedFeatures.maxPrivateChannelsCount;
            if (maxCount === -1) return { allowed: true };

            const usage = await this.getTotalUsage(userId);
            if (usage.totalPrivateChannels >= maxCount) {
                return { 
                    allowed: false, 
                    reason: `Private group limit reached (${usage.totalPrivateChannels}/${maxCount}). Upgrade for more private groups.` 
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error(`[EntitlementService] Error checking private channel creation entitlement:`, error);
            throw error;
        }
    }

    /**
     * Check if a member can be added to a private channel
     * @param userId - The workspace owner's ID
     * @param channelId - The channel ID
     * @returns Object with allowed status and optional reason
     */
    async canAddMemberToPrivateChannel(userId: string, channelId: string): Promise<{ allowed: boolean; reason?: string }> {
        try {
            const plan = await this.getUserPlan(userId);
            if (!plan) return { allowed: true }; // Fallback

            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            const maxMembers = resolvedFeatures.maxMembersPerPrivateChannel;
            
            if (maxMembers === -1) return { allowed: true };

            const channel = await ChatChannel.findById(channelId);
            if (!channel) return { allowed: false, reason: 'Channel not found' };

            const currentMembers = channel.members?.length || 0;
            if (currentMembers >= maxMembers) {
                return { 
                    allowed: false, 
                    reason: `Member limit reached for this private group (${currentMembers}/${maxMembers}). Upgrade your plan to add more members.` 
                };
            }

            return { allowed: true };
        } catch (error) {
            console.error(`[EntitlementService] Error checking private channel member limit:`, error);
            throw error;
        }
    }
}

export default new EntitlementService();
