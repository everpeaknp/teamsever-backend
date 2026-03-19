const Plan = require('../models/Plan');

interface IPlanFeatures {
    maxWorkspaces: number;
    maxMembers: number;
    maxAdmins: number;
    maxSpaces: number;
    maxLists: number;
    maxFolders: number;
    maxTasks: number;
    hasAccessControl: boolean;
    hasGroupChat: boolean;
    messageLimit: number;
    announcementCooldown: number;
    accessControlTier: 'none' | 'basic' | 'pro' | 'advanced';
    canUseCustomRoles: boolean;
    maxCustomRoles: number;
    canCreateTables: boolean;
    maxTablesCount: number;
    maxRowsLimit: number;
    maxColumnsLimit: number;
    maxFiles: number;
    maxDocuments: number;
    maxDirectMessagesPerUser: number;
}

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
    async resolveFeatures(plan: any): Promise<IPlanFeatures> {
        try {
            if (!plan) {
                throw new Error('Plan is required');
            }

            console.log(`[PlanInheritanceService] Resolving features for plan: ${plan.name}`);
            console.log(`[PlanInheritanceService] Plan has parentPlanId: ${plan.parentPlanId}`);
            console.log(`[PlanInheritanceService] Plan features before resolution:`, JSON.stringify(plan.features, null, 2));

            // Base case: no parent plan
            if (!plan.parentPlanId) {
                console.log(`[PlanInheritanceService] No parent plan, returning features as-is`);
                return plan.features;
            }

            // Get parent plan
            const parentPlan = await Plan.findById(plan.parentPlanId);
            if (!parentPlan) {
                // Parent not found, return features as-is
                console.warn(`[PlanInheritanceService] Parent plan ${plan.parentPlanId} not found for plan ${plan._id}`);
                return plan.features;
            }

            console.log(`[PlanInheritanceService] Found parent plan: ${parentPlan.name}`);

            // Recursively resolve parent features
            const parentFeatures = await this.resolveFeatures(parentPlan);

            console.log(`[PlanInheritanceService] Parent features:`, JSON.stringify(parentFeatures, null, 2));
            console.log(`[PlanInheritanceService] Child features:`, JSON.stringify(plan.features, null, 2));

            // Merge features (child overrides parent)
            const merged = this.mergeFeatures(parentFeatures, plan.features);
            
            console.log(`[PlanInheritanceService] Merged features:`, JSON.stringify(merged, null, 2));
            
            return merged;
        } catch (error) {
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
    private mergeFeatures(
        parentFeatures: IPlanFeatures,
        childFeatures: IPlanFeatures
    ): IPlanFeatures {
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

            // Boolean features: child overrides parent
            hasAccessControl: childFeatures.hasAccessControl ?? parentFeatures.hasAccessControl,
            hasGroupChat: childFeatures.hasGroupChat ?? parentFeatures.hasGroupChat,
            canUseCustomRoles: childFeatures.canUseCustomRoles ?? parentFeatures.canUseCustomRoles,
            canCreateTables: childFeatures.canCreateTables ?? parentFeatures.canCreateTables,

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
    private maxValue(a: number, b: number): number {
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
    private maxTier(
        a: 'none' | 'basic' | 'pro' | 'advanced',
        b: 'none' | 'basic' | 'pro' | 'advanced'
    ): 'none' | 'basic' | 'pro' | 'advanced' {
        const tierOrder: Record<string, number> = {
            none: 0,
            basic: 1,
            pro: 2,
            advanced: 3
        };

        return tierOrder[a] > tierOrder[b] ? a : b;
    }
}

export default new PlanInheritanceService();
