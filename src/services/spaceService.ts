const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const AppError = require("../utils/AppError");
const softDelete = require("../utils/softDelete");
const logger = require("../utils/logger");

interface CreateSpaceData {
  name: string;
  description?: string;
  workspace: string;
  owner: string;
}

interface UpdateSpaceData {
  name?: string;
  description?: string;
  status?: "active" | "inactive";
}

class SpaceService {
  async createSpace(data: CreateSpaceData) {
    const { name, description, workspace, owner } = data;

    // Verify workspace exists
    const workspaceDoc = await Workspace.findOne({
      _id: workspace,
      isDeleted: false
    }).populate({
      path: 'owner',
      populate: {
        path: 'subscription.planId',
        model: 'Plan'
      }
    });

    if (!workspaceDoc) {
      throw new AppError("Workspace not found", 404);
    }

    // Verify user is workspace member
    const isOwner = workspaceDoc.owner._id ? workspaceDoc.owner._id.toString() === owner : workspaceDoc.owner.toString() === owner;
    const isMember = workspaceDoc.members.some(
      (member: any) => member.user.toString() === owner
    );

    if (!isOwner && !isMember) {
      throw new AppError("You must be a workspace member to create a space", 403);
    }

    // Check space limit before creating
    const Plan = require("../models/Plan");
    const PlanInheritanceService = require("./planInheritanceService").default;
    const workspaceOwner = workspaceDoc.owner;

    if (!workspaceOwner) {
      throw new AppError('Workspace owner not found', 404);
    }

    // Get workspace owner's plan - either their paid plan or the free plan
    let planToUse = null;

    if (workspaceOwner.subscription?.isPaid && workspaceOwner.subscription.planId) {
      // Owner has a paid subscription
      planToUse = workspaceOwner.subscription.planId;
    } else {
      // Owner is on free plan - fetch the free plan from database
      const freePlan = await Plan.findOne({
        name: { $regex: /free/i },
        isActive: true
      });

      if (!freePlan) {
        // If no free plan exists, allow creation (backward compatibility)
        const space = await Space.create({
          name,
          description,
          workspace,
          owner,
          members: [
            {
              user: owner,
              role: "owner",
              permissionLevel: "FULL"
            }
          ]
        });

        // Also create SpaceMember document for the owner
        const SpaceMember = require("../models/SpaceMember");
        await SpaceMember.create({
          user: owner,
          space: space._id,
          workspace: workspace,
          permissionLevel: "FULL",
          addedBy: owner
        });

        await logger.logActivity({
          userId: owner,
          workspaceId: workspace,
          action: "CREATE",
          resourceType: "Space",
          resourceId: space._id.toString(),
          metadata: { name: space.name }
        });

        await WorkspaceActivity.createActivity({
          workspace,
          user: owner,
          type: "space_created",
          description: `created space "${space.name}"`,
          space: space._id.toString(),
          metadata: { spaceName: space.name }
        });

        return space;
      }

      planToUse = freePlan;
    }

    // Get resolved features from workspace owner's plan
    const resolvedFeatures = await PlanInheritanceService.resolveFeatures(planToUse);
    const maxSpaces = resolvedFeatures.maxSpaces || 1;

    // Count current spaces in workspace
    const currentSpaceCount = await Space.countDocuments({
      workspace: workspace,
      isDeleted: false
    });

    // Check if limit is reached (only if not unlimited)
    if (maxSpaces !== -1 && currentSpaceCount >= maxSpaces) {
      throw new AppError(
        `Space limit reached (${currentSpaceCount}/${maxSpaces}). Upgrade your plan to create more spaces.`,
        400,
        'SPACE_LIMIT_REACHED'
      );
    }

    // Create space with owner as member
    const space = await Space.create({
      name,
      description,
      workspace,
      owner,
      members: [
        {
          user: owner,
          role: "owner",
          permissionLevel: "FULL"
        }
      ]
    });

    // Also create SpaceMember document for the owner
    const SpaceMember = require("../models/SpaceMember");
    await SpaceMember.create({
      user: owner,
      space: space._id,
      workspace: workspace,
      permissionLevel: "FULL",
      addedBy: owner
    });

    // Log activity
    await logger.logActivity({
      userId: owner,
      workspaceId: workspace,
      action: "CREATE",
      resourceType: "Space",
      resourceId: space._id.toString(),
      metadata: { name: space.name }
    });

    // Create workspace activity
    await WorkspaceActivity.createActivity({
      workspace,
      user: owner,
      type: "space_created",
      description: `created space "${space.name}"`,
      space: space._id.toString(),
      metadata: { spaceName: space.name }
    });

    // Invalidate usage cache for workspace owner
    const EntitlementService = require("./entitlementService").default;
    EntitlementService.invalidateUsageCache(workspaceOwner._id.toString());

    return space;
  }

  async getWorkspaceSpaces(workspaceId: string, userId: string) {
    // Import ListMember model
    const ListMember = require("../models/ListMember").ListMember;

    // Verify user is workspace member
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceOwner = workspace.owner.toString() === userId;
    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isWorkspaceOwner && !isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }

    // Check if user is workspace owner or admin
    const workspaceOwnerId = typeof workspace.owner === 'string' ? workspace.owner : workspace.owner?._id?.toString();
    const isOwner = workspaceOwnerId === userId;
    const workspaceMember = workspace.members.find((m: any) => {
      const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
      return memberId === userId;
    });
    const isAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    const allSpaces = await Space.find({
      workspace: workspaceId,
      isDeleted: false
    })
      .populate("owner", "name email")
      .populate("members.user", "name email")
      .sort("-createdAt")
      .lean();

    let spacesToReturn = [];

    // If user is owner or admin, return all spaces
    if (isOwner || isAdmin) {
      spacesToReturn = allSpaces;
    } else {
      // Otherwise, filter to only spaces where user is a member OR has list access

      // Get spaces where user is a space member
      const spacesAsMember = allSpaces.filter((space: any) => {
        return space.members?.some((m: any) => {
          const memberId = typeof m.user === 'string' ? m.user : m.user?._id?.toString();
          return memberId === userId;
        });
      });

      // Get spaces where user has list access (but not space member)
      const userListMemberships = await ListMember.find({
        user: userId,
        workspace: workspaceId
      }).select('space').lean();

      const spacesWithListAccess = [...new Set(userListMemberships.map((lm: any) => lm.space.toString()))];

      // Combine both sets of spaces
      const accessibleSpaceIds = new Set([
        ...spacesAsMember.map((s: any) => s._id.toString()),
        ...spacesWithListAccess
      ]);

      spacesToReturn = allSpaces.filter((space: any) =>
        accessibleSpaceIds.has(space._id.toString())
      );
    }

    // Fetch folders and lists for each space
    const folderService = require("./folderService");
    const listService = require("./listService");

    const spacesWithHierarchy = await Promise.all(
      spacesToReturn.map(async (space: any) => {
        const spaceId = space._id.toString();
        const folders = await folderService.getFolders(spaceId, userId);
        const allLists = await listService.getSpaceLists(spaceId, userId);

        // Filter to only include lists that are NOT in a folder (top-level lists)
        const lists = allLists.filter((list: any) => !list.folderId);

        return {
          ...space,
          folders,
          lists
        };
      })
    );

    return spacesWithHierarchy;
  }

  async getSpaceById(spaceId: string, userId: string) {
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(spaceId)) {
      console.error(`[SpaceService] Invalid space ID format: ${spaceId}`);
      throw new AppError("Invalid space ID format", 400);
    }

    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    })
      .populate("owner", "name email")
      .populate("members.user", "name email")
      .lean();

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Check if user has access (workspace member or space member)
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      console.error(`[SpaceService] Workspace not found with ID: ${space.workspace}`);
      throw new AppError("Workspace not found", 404);
    }

    const isOwner = workspace.owner.toString() === userId;
    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isOwner && !isWorkspaceMember) {
      throw new AppError("You do not have access to this space", 403);
    }

    // Fetch folders and lists for this space
    const folderService = require("./folderService");
    const listService = require("./listService");

    const folders = await folderService.getFolders(spaceId, userId);
    const allLists = await listService.getSpaceLists(spaceId, userId);

    // Filter to only include lists that are NOT in a folder (top-level lists)
    const lists = allLists.filter((list: any) => !list.folderId);

    return {
      ...space,
      folders,
      lists
    };

  }

  async getSpaceMetadataById(spaceId: string, userId: string) {
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(spaceId)) {
      console.error(`[SpaceService] Invalid space ID format: ${spaceId}`);
      throw new AppError("Invalid space ID format", 400);
    }

    // Only fetch essential metadata fields
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    })
      .select('_id name description status color icon workspace owner members createdAt updatedAt')
      .populate("owner", "name email")
      .populate("members.user", "name email")
      .lean();

    if (!space) {
      console.error(`[SpaceService] Space not found with ID: ${spaceId}`);
      throw new AppError("Space not found", 404);
    }

    // Check if user has access (workspace member)
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    }).select('_id name members owner');

    if (!workspace) {
      console.error(`[SpaceService] Workspace not found with ID: ${space.workspace}`);
      throw new AppError("Workspace not found", 404);
    }

    const isOwner = workspace.owner.toString() === userId;
    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isOwner && !isWorkspaceMember) {
      throw new AppError("You do not have access to this space", 403);
    }

    return space;
  }

  async getSpaceListsMetadata(spaceId: string, userId: string) {
    // Validate ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(spaceId)) {
      throw new AppError("Invalid space ID format", 400);
    }

    // Verify space exists and user has access
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    }).select('_id workspace').lean();

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Check workspace access
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    }).select('_id members owner');

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isOwner = workspace.owner.toString() === userId;
    const isWorkspaceMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isOwner && !isWorkspaceMember) {
      throw new AppError("You do not have access to this space", 403);
    }

    // Fetch lists without tasks (lightweight)
    const List = require("../models/List");
    const lists = await List.find({
      space: spaceId,
      isDeleted: false
    })
      .select('_id name description status folderId taskCount completedCount createdAt updatedAt')
      .lean();

    return lists;
  }

  async updateSpace(spaceId: string, userId: string, updateData: UpdateSpaceData) {
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Get workspace to check user role
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Check if user is workspace member
    const isWorkspaceOwner = workspace.owner.toString() === userId;
    const workspaceMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isWorkspaceAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';
    const isWorkspaceMember = isWorkspaceOwner || workspaceMember;

    if (!isWorkspaceMember) {
      throw new AppError("You do not have access to this space", 403);
    }

    // Permission checks for different update types
    if (updateData.name || updateData.description !== undefined) {
      // Only owner/admin can update name/description
      if (!isWorkspaceOwner && !isWorkspaceAdmin) {
        throw new AppError("Only workspace owner or admin can update space details", 403);
      }
    }

    if (updateData.status) {
      // Only owner/admin can change status
      if (!isWorkspaceOwner && !isWorkspaceAdmin) {
        throw new AppError("Only workspace owner or admin can change space status", 403);
      }
    }

    // Capture old state for audit
    const oldValue = space.toObject();

    if (updateData.name) space.name = updateData.name;
    if (updateData.description !== undefined) space.description = updateData.description;
    if (updateData.status) space.status = updateData.status;

    await space.save();

    // Log audit
    await logger.logAudit({
      userId,
      workspaceId: space.workspace.toString(),
      resourceType: "Space",
      resourceId: space._id.toString(),
      oldValue,
      newValue: space.toObject()
    });

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      action: "UPDATE",
      resourceType: "Space",
      resourceId: space._id.toString()
    });

    // Create workspace activity for name change
    if (updateData.name && oldValue.name !== updateData.name) {
      await WorkspaceActivity.createActivity({
        workspace: space.workspace.toString(),
        user: userId,
        type: "space_updated",
        description: `renamed space from "${oldValue.name}" to "${updateData.name}"`,
        space: space._id.toString(),
        metadata: { oldName: oldValue.name, newName: updateData.name }
      });
    }

    return space;
  }

  async deleteSpace(spaceId: string, userId: string) {
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Get workspace to check user role
    const workspace = await Workspace.findById(space.workspace);
    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Permission Check:
    // 1. Workspace Owner bypass
    const isWorkspaceOwner = workspace.owner.toString() === userId;

    // 2. Workspace Admin check
    const workspaceMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isWorkspaceAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    // 3. Space Owner check (creator)
    const isSpaceOwner = space.owner.toString() === userId;

    // 4. Local Space Member check (admin/owner role within space)
    const localMember = space.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isLocalAdmin = localMember?.role === 'admin' || localMember?.role === 'owner';

    if (!isWorkspaceOwner && !isWorkspaceAdmin && !isSpaceOwner && !isLocalAdmin) {
      throw new AppError("Only space owner or admin can delete this space", 403);
    }

    // Invalidate usage cache for workspace owner
    const EntitlementService = require('./entitlementService').default;
    EntitlementService.invalidateUsageCache(workspace.owner.toString());

    await softDelete(Space, spaceId);

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      action: "DELETE",
      resourceType: "Space",
      resourceId: space._id.toString()
    });

    // Create workspace activity
    await WorkspaceActivity.createActivity({
      workspace: space.workspace.toString(),
      user: userId,
      type: "space_deleted",
      description: `deleted space "${space.name}"`,
      metadata: { spaceName: space.name }
    });

    return { message: "Space deleted successfully" };
  }

  async addMemberToSpace(spaceId: string, userId: string, memberId: string, role: 'admin' | 'member' = 'member', permissionLevel?: string) {
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Check if requester has permission (workspace owner/admin)
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceOwner = workspace.owner.toString() === userId;
    const workspaceMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isWorkspaceAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    if (!isWorkspaceOwner && !isWorkspaceAdmin) {
      throw new AppError("Only workspace owner or admin can add members", 403);
    }

    // Check if member already exists in space
    const existingMember = space.members.find(
      (m: any) => m.user.toString() === memberId
    );

    if (existingMember) {
      throw new AppError("User is already a member of this space", 400);
    }

    // Determine permission level: use passed level or default based on role
    const finalPermissionLevel = permissionLevel || (role === 'admin' ? 'FULL' : 'EDIT');

    // Add member to space
    space.members.push({
      user: memberId,
      role,
      permissionLevel: finalPermissionLevel
    });

    await space.save();

    // Also update SpaceMember collection for granular permissions
    const SpaceMember = require("../models/SpaceMember");
    await SpaceMember.findOneAndUpdate(
      { space: spaceId, user: memberId },
      {
        workspace: space.workspace,
        permissionLevel: finalPermissionLevel,
        addedBy: userId
      },
      { upsert: true, new: true }
    );

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      action: "ADD_MEMBER",
      resourceType: "Space",
      resourceId: space._id.toString(),
      metadata: { memberId, role }
    });

    // Create workspace activity
    const User = require("../models/User");
    const targetUser = await User.findById(memberId).select('name');
    await WorkspaceActivity.createActivity({
      workspace: space.workspace.toString(),
      user: userId,
      type: "space_member_added",
      description: `added ${targetUser?.name || 'a member'} to space "${space.name}"`,
      space: space._id.toString(),
      targetUser: memberId,
      metadata: { role }
    });

    return space;
  }

  async removeMemberFromSpace(spaceId: string, userId: string, memberId: string) {
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    });

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Check if requester has permission (workspace owner/admin)
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceOwner = workspace.owner.toString() === userId;
    const workspaceMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isWorkspaceAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    if (!isWorkspaceOwner && !isWorkspaceAdmin) {
      throw new AppError("Only workspace owner or admin can remove members", 403);
    }

    // Cannot remove space owner
    if (space.owner.toString() === memberId) {
      throw new AppError("Cannot remove space owner", 400);
    }

    // Remove member from space
    space.members = space.members.filter(
      (m: any) => m.user.toString() !== memberId
    );

    await space.save();

    // Also remove from SpaceMember collection for granular permissions consistency
    const SpaceMember = require("../models/SpaceMember");
    await SpaceMember.findOneAndDelete({ space: spaceId, user: memberId });

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      action: "REMOVE_MEMBER",
      resourceType: "Space",
      resourceId: space._id.toString(),
      metadata: { memberId }
    });

    // Create workspace activity
    const User = require("../models/User");
    const targetUser = await User.findById(memberId).select('name');
    await WorkspaceActivity.createActivity({
      workspace: space.workspace.toString(),
      user: userId,
      type: "space_member_removed",
      description: `removed ${targetUser?.name || 'a member'} from space "${space.name}"`,
      space: space._id.toString(),
      targetUser: memberId
    });

    return space;
  }

  async inviteExternalUsers(spaceId: string, userId: string, invites: Array<{ email: string; role: 'admin' | 'member' }>) {
    const space = await Space.findOne({
      _id: spaceId,
      isDeleted: false
    }).populate("owner", "name email");

    if (!space) {
      throw new AppError("Space not found", 404);
    }

    // Check if requester has permission (workspace owner/admin)
    const workspace = await Workspace.findOne({
      _id: space.workspace,
      isDeleted: false
    }).populate("owner", "name email");

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceOwner = workspace.owner._id.toString() === userId;
    const workspaceMember = workspace.members.find(
      (m: any) => m.user.toString() === userId || m.user._id?.toString() === userId
    );
    const isWorkspaceAdmin = workspaceMember?.role === 'admin' || workspaceMember?.role === 'owner';

    if (!isWorkspaceOwner && !isWorkspaceAdmin) {
      throw new AppError("Only workspace owner or admin can invite external users", 403);
    }

    // Send invitation emails
    const emailService = require("./emailService");
    const User = require("../models/User");

    const results = [];
    for (const invite of invites) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: invite.email });

        if (existingUser) {
          // Check if already in space
          const isInSpace = space.members.some(
            (m: any) => m.user.toString() === existingUser._id.toString()
          );

          if (isInSpace) {
            results.push({ email: invite.email, status: 'already_member' });
            continue;
          }

          // Add to space directly
          const permissionLevel = invite.role === 'admin' ? 'FULL' : 'EDIT';
          space.members.push({
            user: existingUser._id,
            role: invite.role,
            permissionLevel
          });

          // Sync with SpaceMember collection
          const SpaceMember = require("../models/SpaceMember");
          await SpaceMember.findOneAndUpdate(
            { space: spaceId, user: existingUser._id },
            {
              workspace: space.workspace,
              permissionLevel,
              addedBy: userId
            },
            { upsert: true }
          );
          results.push({ email: invite.email, status: 'added' });
        } else {
          // Send invitation email
          await emailService.sendSpaceInvitation({
            recipientEmail: invite.email,
            spaceName: space.name,
            workspaceName: workspace.name,
            inviterName: workspace.owner.name || 'Team member',
            invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?email=${encodeURIComponent(invite.email)}`
          });
          results.push({ email: invite.email, status: 'invited' });
        }
      } catch (error) {
        console.error(`Failed to process invite for ${invite.email}:`, error);
        results.push({ email: invite.email, status: 'failed' });
      }
    }

    await space.save();

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: space.workspace.toString(),
      action: "INVITE_EXTERNAL",
      resourceType: "Space",
      resourceId: space._id.toString(),
      metadata: { inviteCount: invites.length }
    });

    return { results };
  }

  async generateWebhook(spaceId: string, userId: string, githubRepoName?: string) {
    const space = await Space.findOne({
      _id: spaceId,
    });

    if (!space) {
      throw new AppError('Space not found', 404);
    }

    // Generate a cryptographically secure secret
    const crypto = require('crypto');
    const secret = crypto.randomBytes(32).toString('hex');

    // Build the webhook URL using the public backend URL
    let baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, "");
    const webhookUrl = `${baseUrl}/api/webhooks/github/${spaceId}`;

    // Save to the space document
    (space as any).githubWebhookSecret = secret;
    if (githubRepoName) {
      (space as any).githubRepoName = githubRepoName;
    }
    await space.save();

    return {
      webhookUrl,
      secret,
      githubRepoName: githubRepoName || (space as any).githubRepoName || '',
    };
  }
}

module.exports = new SpaceService();

export { };
