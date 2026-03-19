import { Request, Response } from 'express';
import EntitlementService from '../services/entitlementService';

/**
 * Check if user can perform a specific action
 * GET /api/entitlements/check?action=<action>
 */
export const checkEntitlement = async (req: Request, res: Response) => {
    try {
        const { action } = req.query;
        const userId = (req as any).user._id.toString();

        if (!action || typeof action !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Action parameter is required'
            });
        }

        let result: { allowed: boolean; reason?: string };
        let currentUsage: number | undefined;
        let limit: number | undefined;

        switch (action) {
            case 'useCustomRoles':
                // For custom roles, we need to check the workspace owner's plan
                const { workspaceId: customRoleWorkspaceId } = req.query;
                if (customRoleWorkspaceId && typeof customRoleWorkspaceId === 'string') {
                    // Check workspace owner's plan
                    result = await EntitlementService.canUseCustomRolesInWorkspace(customRoleWorkspaceId);
                } else {
                    // Fallback to checking user's own plan (for backward compatibility)
                    result = await EntitlementService.canUseCustomRoles(userId);
                }
                break;

            case 'createTable':
                result = await EntitlementService.canCreateTable(userId);
                if (!result.allowed && result.reason?.includes('limit reached')) {
                    const usage = await EntitlementService.getTotalUsage(userId);
                    currentUsage = usage.totalTables;
                    // Extract limit from reason string (format: "Table limit reached (X/Y)")
                    const match = result.reason.match(/\((\d+)\/(\d+)\)/);
                    if (match) {
                        limit = parseInt(match[2]);
                    }
                }
                break;

            case 'addRow':
                result = await EntitlementService.canAddRow(userId);
                if (!result.allowed && result.reason?.includes('limit reached')) {
                    const usage = await EntitlementService.getTotalUsage(userId);
                    currentUsage = usage.totalRows;
                    // Extract limit from reason string (format: "Row limit reached (X/Y)")
                    const match = result.reason.match(/\((\d+)\/(\d+)\)/);
                    if (match) {
                        limit = parseInt(match[2]);
                    }
                }
                break;

            case 'addColumn':
                const { tableId } = req.query;
                if (!tableId || typeof tableId !== 'string') {
                    return res.status(400).json({
                        success: false,
                        message: 'tableId parameter is required for addColumn action'
                    });
                }
                result = await EntitlementService.canAddColumn(userId, tableId);
                if (!result.allowed && result.reason?.includes('limit reached')) {
                    // Extract current and limit from reason string (format: "Column limit reached (X/Y)")
                    const match = result.reason.match(/\((\d+)\/(\d+)\)/);
                    if (match) {
                        currentUsage = parseInt(match[1]);
                        limit = parseInt(match[2]);
                    }
                }
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: `Invalid action: ${action}. Supported actions: useCustomRoles, createTable, addRow, addColumn`
                });
        }

        return res.status(200).json({
            success: true,
            allowed: result.allowed,
            reason: result.reason,
            currentUsage,
            limit
        });
    } catch (error: any) {
        console.error('[EntitlementController] Error checking entitlement:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check entitlement',
            error: error.message
        });
    }
};

/**
 * Get aggregated usage and limits across all owned workspaces
 * GET /api/entitlements/usage
 */
export const getUsage = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id.toString();

        // Get total usage
        const usage = await EntitlementService.getTotalUsage(userId);

        // Get user's plan to retrieve limits
        const User = require('../models/User');
        const Plan = require('../models/Plan');
        const PlanInheritanceService = require('../services/planInheritanceService').default;

        const user = await User.findById(userId).populate('subscription.planId');
        let limits = {
            maxWorkspaces: 0,
            maxSpaces: 0,
            maxLists: 0,
            maxFolders: 0,
            maxTasks: 0,
            maxTablesCount: 0,
            maxRowsLimit: 0,
            maxColumnsLimit: 0
        };

        if (user && user.subscription?.planId) {
            const plan = user.subscription.planId;
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            
            limits = {
                maxWorkspaces: resolvedFeatures.maxWorkspaces || 0,
                maxSpaces: resolvedFeatures.maxSpaces || 0,
                maxLists: resolvedFeatures.maxLists || 0,
                maxFolders: resolvedFeatures.maxFolders || 0,
                maxTasks: resolvedFeatures.maxTasks || 0,
                maxTablesCount: resolvedFeatures.maxTablesCount || 0,
                maxRowsLimit: resolvedFeatures.maxRowsLimit || 0,
                maxColumnsLimit: resolvedFeatures.maxColumnsLimit || 0
            };
        } else {
            // Get free plan limits
            const freePlan = await Plan.findOne({ name: 'Free' });
            if (freePlan) {
                const resolvedFeatures = await PlanInheritanceService.resolveFeatures(freePlan);
                limits = {
                    maxWorkspaces: resolvedFeatures.maxWorkspaces || 0,
                    maxSpaces: resolvedFeatures.maxSpaces || 0,
                    maxLists: resolvedFeatures.maxLists || 0,
                    maxFolders: resolvedFeatures.maxFolders || 0,
                    maxTasks: resolvedFeatures.maxTasks || 0,
                    maxTablesCount: resolvedFeatures.maxTablesCount || 0,
                    maxRowsLimit: resolvedFeatures.maxRowsLimit || 0,
                    maxColumnsLimit: resolvedFeatures.maxColumnsLimit || 0
                };
            }
        }

        return res.status(200).json({
            success: true,
            usage: {
                totalWorkspaces: usage.totalWorkspaces,
                totalSpaces: usage.totalSpaces,
                totalLists: usage.totalLists,
                totalFolders: usage.totalFolders,
                totalTasks: usage.totalTasks,
                totalTables: usage.totalTables,
                totalRows: usage.totalRows
            },
            limits
        });
    } catch (error: any) {
        console.error('[EntitlementController] Error getting usage:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get usage',
            error: error.message
        });
    }
};
