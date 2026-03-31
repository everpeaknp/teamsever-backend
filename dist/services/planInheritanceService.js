"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Plan = require('../models/Plan');
/**
 * PlanInheritanceService
 * Handles plan feature inheritance and resolution
 */
class PlanInheritanceService {
    /**
     * Resolve plan features including inheritance from parent plans
     * @param plan - The plan to resolve features for
     * @returns Resolved features with inheritance applied
     */
    async resolveFeatures(plan) {
        try {
            if (!plan) {
                throw new Error('Plan is required');
            }
            // Base case: no parent plan
            if (!plan.parentPlanId) {
                return plan.features;
            }
            // Get parent plan
            const parentPlan = await Plan.findById(plan.parentPlanId);
            if (!parentPlan) {
                // Parent not found, return features as-is
                return plan.features;
            }
            // Recursively resolve parent features
            const parentFeatures = await this.resolveFeatures(parentPlan);
            // Merge features (child overrides parent)
            const merged = this.mergeFeatures(parentFeatures, plan.features);
            return merged;
        }
        catch (error) {
            console.error(`[PlanInheritanceService] Error resolving plan features:`, error);
            throw error;
        }
    }
    /**
     * Merge parent and child features
     * Child features override parent features ALWAYS
     *
     * @param parentFeatures - Features from parent plan
     * @param childFeatures - Features from child plan
     * @returns Merged features
     */
    mergeFeatures(parentFeatures, childFeatures) {
        return {
            // Numeric limits: child overrides parent (use child value if defined, otherwise use parent)
            maxWorkspaces: childFeatures.maxWorkspaces ?? parentFeatures.maxWorkspaces,
            maxMembers: childFeatures.maxMembers ?? parentFeatures.maxMembers,
            maxAdmins: childFeatures.maxAdmins ?? parentFeatures.maxAdmins,
            maxSpaces: childFeatures.maxSpaces ?? parentFeatures.maxSpaces,
            maxLists: childFeatures.maxLists ?? parentFeatures.maxLists,
            maxFolders: childFeatures.maxFolders ?? parentFeatures.maxFolders,
            maxTasks: childFeatures.maxTasks ?? parentFeatures.maxTasks,
            messageLimit: childFeatures.messageLimit ?? parentFeatures.messageLimit,
            maxCustomRoles: childFeatures.maxCustomRoles ?? parentFeatures.maxCustomRoles ?? -1,
            maxTablesCount: childFeatures.maxTablesCount ?? parentFeatures.maxTablesCount ?? -1,
            maxRowsLimit: childFeatures.maxRowsLimit ?? parentFeatures.maxRowsLimit ?? -1,
            maxColumnsLimit: childFeatures.maxColumnsLimit ?? parentFeatures.maxColumnsLimit ?? -1,
            maxFiles: childFeatures.maxFiles ?? parentFeatures.maxFiles ?? -1,
            maxDocuments: childFeatures.maxDocuments ?? parentFeatures.maxDocuments ?? -1,
            maxDirectMessagesPerUser: childFeatures.maxDirectMessagesPerUser ?? parentFeatures.maxDirectMessagesPerUser ?? -1,
            maxPrivateChannelsCount: childFeatures.maxPrivateChannelsCount ?? parentFeatures.maxPrivateChannelsCount ?? -1,
            maxMembersPerPrivateChannel: childFeatures.maxMembersPerPrivateChannel ?? parentFeatures.maxMembersPerPrivateChannel ?? -1,
            // Boolean features: child overrides parent
            hasAccessControl: childFeatures.hasAccessControl ?? parentFeatures.hasAccessControl,
            hasGroupChat: childFeatures.hasGroupChat ?? parentFeatures.hasGroupChat,
            canUseCustomRoles: childFeatures.canUseCustomRoles ?? parentFeatures.canUseCustomRoles,
            canCreateTables: childFeatures.canCreateTables ?? parentFeatures.canCreateTables,
            canCreatePrivateChannels: childFeatures.canCreatePrivateChannels ?? parentFeatures.canCreatePrivateChannels,
            // Announcement cooldown: child overrides parent
            announcementCooldown: childFeatures.announcementCooldown ?? parentFeatures.announcementCooldown,
            // Tier features: child overrides parent
            accessControlTier: childFeatures.accessControlTier ?? parentFeatures.accessControlTier
        };
    }
    /**
     * Get maximum value between two numbers
     * -1 means unlimited, which is always the maximum
     *
     * @param a - First value
     * @param b - Second value
     * @returns Maximum value
     */
    maxValue(a, b) {
        if (a === -1 || b === -1) {
            return -1; // Unlimited
        }
        return Math.max(a, b);
    }
    /**
     * Get maximum access control tier
     * Tier order: none < basic < pro < advanced
     *
     * @param a - First tier
     * @param b - Second tier
     * @returns Higher tier
     */
    maxTier(a, b) {
        const tierOrder = {
            none: 0,
            basic: 1,
            pro: 2,
            advanced: 3
        };
        return tierOrder[a] > tierOrder[b] ? a : b;
    }
}
exports.default = new PlanInheritanceService();
