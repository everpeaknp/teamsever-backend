const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");

interface CreateWorkspaceData {
  name: string;
  owner: string;
}

class WorkspaceService {
  async createWorkspace(data: CreateWorkspaceData) {
    // Check workspace limit before creating
    const User = require("../models/User");
    const Plan = require("../models/Plan");
    const PlanInheritanceService = require("./planInheritanceService").default;
    
    const user = await User.findById(data.owner).populate('subscription.planId');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get user's plan - either their paid plan or the free plan
    let planToUse = null;
    
    if (user.subscription?.isPaid && user.subscription.planId) {
      // User has a paid subscription
      planToUse = user.subscription.planId;
    } else {
      // User is on free plan - fetch the free plan from database
      const freePlan = await Plan.findOne({ 
        name: { $regex: /free/i }, 
        isActive: true 
      });
      
      if (!freePlan) {
        // If no free plan exists, allow creation (backward compatibility)
        console.log('[WorkspaceService] No free plan found, allowing workspace creation');
        const workspace = await Workspace.create({
          name: data.name,
          owner: data.owner,
          members: [
            {
              user: data.owner,
              role: "owner",
              status: "inactive"
            }
          ]
        });

        await logger.logActivity({
          userId: data.owner,
          workspaceId: workspace._id.toString(),
          action: "CREATE",
          resourceType: "Workspace",
          resourceId: workspace._id.toString(),
          metadata: { name: workspace.name }
        });

        return workspace;
      }
      
      planToUse = freePlan;
    }
    
    // Get resolved features from plan
    const resolvedFeatures = await PlanInheritanceService.resolveFeatures(planToUse);
    const maxWorkspaces = resolvedFeatures.maxWorkspaces || 1;
    
    // Count current workspaces owned by user
    const currentWorkspaceCount = await Workspace.countDocuments({
      owner: data.owner,
      isDeleted: false
    });
    
    console.log('[WorkspaceService] Workspace limit check:', {
      userId: data.owner,
      currentCount: currentWorkspaceCount,
      maxAllowed: maxWorkspaces,
      planName: planToUse.name
    });
    
    // Check if limit is reached (only if not unlimited)
    if (maxWorkspaces !== -1 && currentWorkspaceCount >= maxWorkspaces) {
      throw new AppError(
        `Workspace limit reached (${currentWorkspaceCount}/${maxWorkspaces}). Upgrade your plan to create more workspaces.`,
        400,
        'WORKSPACE_LIMIT_REACHED'
      );
    }
    
    const workspace = await Workspace.create({
      name: data.name,
      owner: data.owner,
      members: [
        {
          user: data.owner,
          role: "owner",
          status: "inactive" // Owner starts clocked out by default
        }
      ]
    });

    await logger.logActivity({
      userId: data.owner,
      workspaceId: workspace._id.toString(),
      action: "CREATE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString(),
      metadata: { name: workspace.name }
    });

    // Invalidate usage cache for user
    const EntitlementService = require("./entitlementService").default;
    EntitlementService.invalidateUsageCache(data.owner);
    console.log('[WorkspaceService] Invalidated usage cache for user');

    return workspace;
  }

  async getUserWorkspaces(userId: string) {
    const workspaces = await Workspace.find({
      isDeleted: false,
      $or: [{ owner: userId }, { "members.user": userId }]
    })
      .populate({
        path: "owner",
        select: "name email avatar subscription",
        populate: {
          path: "subscription.planId",
          model: "Plan"
        }
      })
      .populate("members.user", "name email avatar")
      .sort("-createdAt");

    // Transform workspaces to include subscription at workspace level
    const Plan = require("../models/Plan");
    
    const transformedWorkspaces = await Promise.all(workspaces.map(async (workspace: any) => {
      const workspaceObj = workspace.toObject();
      
      if (workspaceObj.owner && workspaceObj.owner.subscription && workspaceObj.owner.subscription.planId) {
        // Use plan features directly
        const planFeatures = workspaceObj.owner.subscription.planId.features;
        
        workspaceObj.subscription = {
          isPaid: workspaceObj.owner.subscription.isPaid,
          status: workspaceObj.owner.subscription.status,
          plan: workspaceObj.owner.subscription.planId,
          resolvedFeatures: planFeatures
        };
      } else {
        // Use free plan
        const freePlan = await Plan.findOne({ 
          name: { $regex: /free/i }, 
          isActive: true 
        });
        
        if (freePlan) {
          workspaceObj.subscription = {
            isPaid: false,
            status: 'free',
            plan: freePlan,
            resolvedFeatures: freePlan.features
          };
        }
      }
      
      return workspaceObj;
    }));
    
    return transformedWorkspaces;
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    })
      .populate({
        path: "owner",
        select: "name email avatar subscription",
        populate: {
          path: "subscription.planId",
          model: "Plan"
        }
      })
      .populate("members.user", "name email avatar");

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const hasAccess =
      workspace.owner._id.toString() === userId ||
      workspace.members.some((member: any) => member.user._id.toString() === userId);

    if (!hasAccess) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Transform the response to include subscription at workspace level for easier access
    const workspaceObj = workspace.toObject();
    
    // Always try to get plan information
    const Plan = require("../models/Plan");
    let planFeatures = null;
    let planToUse = null;
    
    if (workspaceObj.owner && workspaceObj.owner.subscription && workspaceObj.owner.subscription.planId) {
      // Owner has a paid subscription - use their plan features directly
      planToUse = workspaceObj.owner.subscription.planId;
      planFeatures = planToUse.features;
      
      workspaceObj.subscription = {
        isPaid: workspaceObj.owner.subscription.isPaid,
        status: workspaceObj.owner.subscription.status,
        plan: planToUse,
        resolvedFeatures: planFeatures // Just use plan features directly
      };
    } else {
      // Owner doesn't have a paid subscription - use free plan
      const freePlan = await Plan.findOne({ 
        name: { $regex: /free/i }, 
        isActive: true 
      });
      
      if (freePlan) {
        workspaceObj.subscription = {
          isPaid: false,
          status: 'free',
          plan: freePlan,
          resolvedFeatures: freePlan.features
        };
      } else {
        // No free plan found, provide default values
        workspaceObj.subscription = {
          isPaid: false,
          status: 'free',
          plan: null,
          resolvedFeatures: {
            maxWorkspaces: 1,
            maxMembers: 2,
            maxAdmins: 1,
            maxSpaces: 2,
            maxLists: 4,
            maxFolders: 2,
            maxTasks: 100,
            hasAccessControl: false,
            hasGroupChat: false,
            messageLimit: 0,
            announcementCooldown: 24,
            accessControlTier: 'none',
            canUseCustomRoles: false,
            maxCustomRoles: 0,
            canCreateTables: false,
            maxTablesCount: 0,
            maxRowsLimit: 0,
            maxColumnsLimit: 0,
            maxFiles: 0,
            maxDocuments: 0,
            maxDirectMessagesPerUser: 0
          }
        };
      }
    }

    return workspaceObj;
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    if (workspace.owner.toString() !== userId) {
      throw new AppError("Only workspace owner can delete this workspace", 403);
    }

    await softDelete(Workspace, workspaceId);

    // Invalidate usage cache for workspace owner
    const EntitlementService = require('./entitlementService').default;
    EntitlementService.invalidateUsageCache(workspace.owner.toString());

    await logger.logActivity({
      userId,
      workspaceId: workspace._id.toString(),
      action: "DELETE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString()
    });

    return { message: "Workspace deleted successfully" };
  }

  async updateWorkspace(workspaceId: string, userId: string, updateData: { name?: string }) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    if (workspace.owner.toString() !== userId) {
      throw new AppError("Only workspace owner can update this workspace", 403);
    }

    const oldValue = workspace.toObject();

    if (updateData.name) {
      workspace.name = updateData.name;
    }

    if (updateData.logo) {
      workspace.logo = updateData.logo;
    }

    await workspace.save();

    await logger.logAudit({
      userId,
      workspaceId: workspace._id.toString(),
      resourceType: "Workspace",
      resourceId: workspace._id.toString(),
      oldValue,
      newValue: workspace.toObject()
    });

    await logger.logActivity({
      userId,
      workspaceId: workspace._id.toString(),
      action: "UPDATE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString()
    });

    return workspace;
  }

  async getWorkspaceAnalytics(workspaceId: string, userId: string) {
    // Dynamic requires to prevent circular dependencies
    const Space = require("../models/Space");
    const List = require("../models/List");
    const Task = require("../models/Task");
    const TimeEntry = require("../models/TimeEntry");

    // 1. Fetch Workspace & Members (populated for UI badges/avatars)
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    })
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar")
      .lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // 2. Security Check
    const hasAccess =
      workspace.owner._id.toString() === userId ||
      workspace.members.some((member: any) => member.user._id.toString() === userId);

    if (!hasAccess) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // 3. Fetch Data Tree (Spaces -> Lists -> Tasks)
    const spaces = await Space.find({ workspace: workspaceId, isDeleted: false })
      .select("_id name color status")
      .lean();

    const spaceIds = spaces.map((s: any) => s._id);

    const lists = await List.find({ space: { $in: spaceIds }, isDeleted: false })
      .select("_id space")
      .lean();

    const listIds = lists.map((l: any) => l._id);

    const tasks = await Task.find({ list: { $in: listIds }, isDeleted: false })
      .select("_id name status priority assignee space list workspace createdAt updatedAt")
      .populate("assignee", "name email avatar")
      .lean();

    // 4. Fetch the specific running timer for the current user
    // This allows the frontend to calculate the "ticking" seconds on refresh
    const currentRunningTimer = await TimeEntry.findOne({
      user: userId,
      workspace: workspaceId,
      isRunning: true,
      isDeleted: false
    })
      .select("_id startTime isRunning description")
      .sort("-startTime") // Get the most recent one if duplicates exist
      .lean();

    return {
      workspace,
      spaces,
      tasks,
      members: workspace.members,
      currentRunningTimer // Crucial for persistence
    };
  }

  async updateMemberCustomRole(workspaceId: string, memberId: string, customRoleTitle: string | null) {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Find the member in the workspace
    const member = workspace.members.find((m: any) => m.user.toString() === memberId);

    if (!member) {
      throw new AppError("Member not found in this workspace", 404);
    }

    // Update the custom role title
    member.customRoleTitle = customRoleTitle;

    await workspace.save();

    // Populate the member user data for the response
    await workspace.populate("members.user", "name email avatar");

    // Find and return the updated member
    const updatedMember = workspace.members.find((m: any) => m.user._id.toString() === memberId);

    return updatedMember;
  }
}

module.exports = new WorkspaceService();

export {};