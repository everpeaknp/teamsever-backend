import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";
import xss from "xss";

const asyncHandler = require("../utils/asyncHandler");
const workspaceService = require("../services/workspaceService");
const HierarchyService = require("../services/hierarchyService").default;
const AppError = require("../utils/AppError");

// @desc    Create new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name } = req.body;

  if (!name) {
    throw new AppError("Please provide workspace name", 400);
  }

  const workspace = await workspaceService.createWorkspace({
    name,
    owner: req.user!.id
  });

  res.status(201).json({
    success: true,
    data: workspace
  });
});

// @desc    Get all user workspaces
// @route   GET /api/workspaces
// @access  Private
const getMyWorkspaces = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaces = await workspaceService.getUserWorkspaces(req.user!.id);

  res.status(200).json({
    success: true,
    data: workspaces
  });
});

// @desc    Get single workspace
// @route   GET /api/workspaces/:id
// @access  Private
const getWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  
  const workspace = await workspaceService.getWorkspaceById(req.params.id, req.user!.id);


  res.status(200).json({
    success: true,
    data: workspace
  });
});

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private
const updateWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { name, logo } = req.body;

  const workspace = await workspaceService.updateWorkspace(req.params.id, req.user!.id, { name, logo });

  res.status(200).json({
    success: true,
    data: workspace
  });
});

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:id
// @access  Private
const deleteWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const result = await workspaceService.deleteWorkspace(req.params.id, req.user!.id);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Get workspace analytics data
// @route   GET /api/workspaces/:id/analytics
// @access  Private
const getWorkspaceAnalytics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestedView = typeof req.query.view === "string" ? req.query.view : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const analytics = await workspaceService.getWorkspaceAnalytics(req.params.id, req.user!.id, requestedView, { from, to });

  res.status(200).json({
    success: true,
    message: "Consolidated analytics data retrieved successfully",
    data: analytics
  });
});

// @desc    Update member custom role title
// @route   PATCH /api/workspaces/:workspaceId/members/:memberId/custom-role
// @access  Private (Workspace Owner Only)
const updateMemberCustomRole = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { workspaceId, memberId } = req.params;
  let { customRoleTitle } = req.body;

  // Validate customRoleTitle
  if (customRoleTitle !== null && customRoleTitle !== undefined) {
    // Sanitize input with xss library
    customRoleTitle = xss(customRoleTitle);
    
    // Validate length (max 50 chars)
    if (customRoleTitle.length > 50) {
      throw new AppError("Custom role title cannot exceed 50 characters", 400);
    }
    
    // Trim whitespace
    customRoleTitle = customRoleTitle.trim();
    
    // If empty after trimming, set to null
    if (customRoleTitle === "") {
      customRoleTitle = null;
    }
  }

  // Check predefined role-title entitlement if adding a new one
  if (customRoleTitle) {
    const Workspace = require('../models/Workspace');
    
    // Get workspace to check current custom roles
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }
    
    // Get the member being updated
    const member = workspace.members.find((m: any) => m.user.toString() === memberId);
    if (!member) {
      throw new AppError('Member not found', 404);
    }
    
    // If member doesn't already have a role title, check feature + limit
    if (!member.customRoleTitle) {
      // Count current custom roles in workspace
      const currentCustomRoleCount = workspace.members.filter((m: any) => 
        m.customRoleTitle && m.customRoleTitle.trim() !== ''
      ).length;
      
      // Get owner's plan limits
      const ownerId = workspace.owner.toString();
      const User = require('../models/User');
      const Plan = require('../models/Plan');
      const PlanInheritanceService = require('../services/planInheritanceService').default;
      
      const owner = await User.findById(ownerId).populate('subscription.planId');
      if (!owner) {
        throw new AppError('Owner not found', 404);
      }
      
      // Get plan - either paid plan or free plan
      let planToUse = null;
      
      if (owner.subscription?.isPaid && owner.subscription.planId) {
        planToUse = owner.subscription.planId;
      } else {
        // Try to find free plan
        const freePlan = await Plan.findOne({ 
          name: { $regex: /free/i }, 
          isActive: true 
        });
        
        if (!freePlan) {
          // No plan found, default to 0 custom roles
          return res.status(400).json({
            success: false,
            code: 'CUSTOM_ROLE_LIMIT_REACHED',
            message: `Custom role limit reached (${currentCustomRoleCount}/0). Upgrade your plan to add custom roles.`,
            currentCount: currentCustomRoleCount,
            maxAllowed: 0
          });
        }
        
        planToUse = freePlan;
      }
      
      const resolvedFeatures = await PlanInheritanceService.resolveFeatures(planToUse);
      const canUsePredefinedRoles = resolvedFeatures.canUsePredefinedRoles !== false;
      const maxPredefinedRoles =
        resolvedFeatures.maxPredefinedRoles !== undefined && resolvedFeatures.maxPredefinedRoles !== null
          ? resolvedFeatures.maxPredefinedRoles
          : resolvedFeatures.maxCustomRoles ?? -1;

      if (!canUsePredefinedRoles) {
        return res.status(403).json({
          success: false,
          code: 'PREDEFINED_ROLES_NOT_AVAILABLE',
          message: 'Predefined role titles are not available in your current plan.'
        });
      }
      
      // Check if limit is reached
      if (maxPredefinedRoles !== -1 && currentCustomRoleCount >= maxPredefinedRoles) {
        return res.status(400).json({
          success: false,
          code: 'PREDEFINED_ROLE_LIMIT_REACHED',
          message: `Predefined role title limit reached (${currentCustomRoleCount}/${maxPredefinedRoles}). Upgrade your plan to add more.`,
          currentCount: currentCustomRoleCount,
          maxAllowed: maxPredefinedRoles
        });
      }
    }
  }

  // Update the member's custom role
  const updatedMember = await workspaceService.updateMemberCustomRole(
    workspaceId,
    memberId,
    customRoleTitle
  );

  res.status(200).json({
    success: true,
    message: "Member custom role updated successfully",
    data: updatedMember
  });
});

// @desc    Get workspace hierarchy (optimized single query)
// @route   GET /api/workspaces/:id/hierarchy
// @access  Private
const getWorkspaceHierarchy = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Get user role for permission check
  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(req.params.id).select('owner members');
  const isOwner = workspace.owner.toString() === req.user!.id;
  const member = workspace.members.find((m: any) => m.user.toString() === req.user!.id);
  const userRole = isOwner ? 'owner' : (member?.role || 'member');

  const hierarchy = await HierarchyService.getWorkspaceHierarchy(req.params.id, req.user!.id, userRole);



  res.status(200).json({
    success: true,
    message: "Workspace hierarchy retrieved successfully",
    data: hierarchy
  });
});

// @desc    Upload workspace logo
// @route   PATCH /api/workspaces/:id/logo
// @access  Private (Workspace Owner Only)
const uploadLogo = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: workspaceId } = req.params;
  const file = req.file;

  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  const uploadService = require("../services/uploadService");
  const result = await uploadService.uploadWorkspaceLogo({
    file,
    workspaceId: workspaceId,
    uploadedBy: req.user!.id
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

module.exports = {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceAnalytics,
  updateMemberCustomRole,
  getWorkspaceHierarchy,
  uploadLogo
};

export {};
