const crypto = require("crypto");
const Invitation = require("../models/Invitation");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const emailService = require("./emailService");
const notificationService = require("./enhancedNotificationService");

interface SendInviteData {
  email?: string;
  workspaceId: string;
  role: "admin" | "member";
  invitedBy: string;
  inviteType?: "email" | "link";
  spaceId?: string;
  spacePermissionLevel?: "FULL" | "EDIT" | "COMMENT" | "VIEW";
  expiresInHours?: number;
}

class InvitationService {
  /**
   * Send invitation to join workspace
   */
  async sendInvite(data: SendInviteData) {
    const { 
      email, 
      workspaceId, 
      role, 
      invitedBy, 
      inviteType = "email", 
      spaceId, 
      spacePermissionLevel = "EDIT",
      expiresInHours
    } = data;

    // Verify workspace exists and is not deleted
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Check if inviter is a workspace member
    const inviterMember = workspace.members.find(
      (member: any) => member.user && member.user.toString() === invitedBy
    );
    const isWorkspaceOwner = workspace.owner.toString() === invitedBy;

    if (!inviterMember && !isWorkspaceOwner) {
      throw new AppError("You are not a member of this workspace", 403);
    }

    // If email invite: check target user isn't already a member
    if (inviteType === "email" && email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const isAlreadyMember = workspace.members.some(
          (member: any) => member.user.toString() === existingUser._id.toString()
        );
        if (isAlreadyMember) {
          throw new AppError("User is already a member of this workspace", 400);
        }
      }
    }

    // If spaceId provided: validate it belongs to this workspace
    let validatedSpace: any = null;
    if (spaceId) {
      const Space = require("../models/Space");
      validatedSpace = await Space.findOne({ _id: spaceId, workspace: workspaceId, isDeleted: false });
      if (!validatedSpace) {
        throw new AppError("Space not found or does not belong to this workspace", 400);
      }
    }

    // Check for existing pending invitation (only for email-type invites)
    const existingInvite = inviteType === "email" && email ? await Invitation.findOne({
      email: email.toLowerCase(),
      workspaceId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    }) : null;

    // If there's an existing pending invitation, just resend the email with the same token
    if (existingInvite) {
      console.log(`Found existing invitation for ${email} to workspace ${workspaceId}, resending email`);
      
      // Populate invitation details for email
      await existingInvite.populate("invitedBy", "name email");
      await existingInvite.populate("workspaceId", "name");
      
      // Resend invitation (non-blocking)
      setImmediate(async () => {
        try {
          const inviter = await User.findById(invitedBy);
          if (!inviter) return;

          const frontendUrl = process.env.FRONTEND_URL || "https://teamsever.vercel.app";
          const inviteUrl = `${frontendUrl}/join?token=${existingInvite.token}`;

          // 1. Re-send in-app notification FIRST (more reliable)
          try {
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
              await notificationService.createNotification({
                recipientId: existingUser._id.toString(),
                type: "INVITATION",
                title: "Workspace Invitation Reminder",
                body: `${inviter.name} is waiting for you to join ${workspace.name}`,
                data: {
                  workspaceId,
                  token: existingInvite.token,
                  inviteUrl,
                  workspaceName: workspace.name,
                  inviterName: inviter.name,
                },
              });
              console.log(`[InvitationService] In-app reminder sent to ${email}`);
            }
          } catch (notifError) {
            console.error("[InvitationService] Failed to resend in-app notification:", notifError);
          }
          
          // 2. Resend invitation email SECOND
          try {
            await emailService.sendWorkspaceInvitation({
              recipientEmail: email,
              recipientName: email.split('@')[0],
              inviterName: inviter.name,
              workspaceName: workspace.name,
              role: role,
              workspaceLink: inviteUrl
            });
            console.log(`[InvitationService] Email reminder sent to ${email}`);
          } catch (emailError) {
            console.error("[InvitationService] Failed to resend email (notification was already sent):", emailError);
          }
        } catch (error) {
          console.error("[InvitationService] Critical error in resend loop:", error);
        }
      });
      
      return existingInvite;
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Generate short code for link-type invites (8 uppercase alphanumeric chars)
    // e.g. "A3BX9K2T" — easy to type on mobile
    const shortCode = inviteType === "link"
      ? crypto.randomBytes(4).toString("hex").toUpperCase()
      : null;

    // Set expiry (defaults to 7 days if not provided)
    const hours = expiresInHours && expiresInHours > 0 ? expiresInHours : (7 * 24);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);

    // Create invitation
    const invitation = await Invitation.create({
      email: inviteType === "email" && email ? email.toLowerCase() : null,
      workspaceId,
      role,
      invitedBy,
      token,
      shortCode,
      expiresAt,
      inviteType,
      spaceId: (spaceId && spaceId !== "none") ? spaceId : null,
      spacePermissionLevel: (spaceId && spaceId !== "none") ? (spacePermissionLevel || "EDIT") : "EDIT"
    });

    console.log(`[InvitationService] Created invitation ${invitation._id}:`, {
      token: invitation.token.substring(0, 8) + "...",
      spaceId: invitation.spaceId,
      spacePermissionLevel: invitation.spacePermissionLevel
    });

    // Log activity
    await logger.logActivity({
      userId: invitedBy,
      workspaceId,
      action: "CREATE",
      resourceType: "Workspace",
      resourceId: workspaceId,
      metadata: {
        invitedEmail: email,
        role,
        invitationId: invitation._id
      }
    });

    // Populate invitation details for response
    await invitation.populate("invitedBy", "name email");
    await invitation.populate("workspaceId", "name");

    // Create notification for invited user (if they have an account) — email invites only
    if (inviteType === "email" && email) {
      try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          const inviter = await User.findById(invitedBy);
          const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
          const spaceSuffix = validatedSpace ? ` → ${validatedSpace.name}` : "";
          
          await notificationService.createNotification({
            recipientId: existingUser._id.toString(),
            type: "INVITATION",
            title: "Workspace Invitation",
            body: `${inviter?.name || 'Someone'} invited you to join ${workspace.name}${spaceSuffix}`,
            data: {
              workspaceId,
              token,
              inviteUrl: `${frontendUrl}/join?token=${token}`,
              workspaceName: workspace.name,
              inviterName: inviter?.name,
              spaceId: spaceId || null,
              spaceName: validatedSpace?.name || null,
            },
          });
        }
      } catch (error) {
        console.error("Failed to create invitation notification:", error);
      }
    }

    // Send invitation email in the background — email invites only
    if (inviteType === "email" && email) {
      setImmediate(async () => {
        try {
          const inviter = await User.findById(invitedBy);
          if (inviter) {
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const inviteUrl = `${frontendUrl}/join?token=${token}`;
            
            await emailService.sendWorkspaceInvitation({
              recipientEmail: email,
              recipientName: email.split('@')[0],
              inviterName: inviter.name,
              workspaceName: workspace.name,
              role: role,
              workspaceLink: inviteUrl
            });
            console.log(`Invitation email sent to ${email} for workspace ${workspace.name}`);
          }
        } catch (emailError) {
          console.error("Failed to send invitation email:", emailError);
        }
      });
    }

    return invitation;
  }

  /**
   * Accept invitation and join workspace
   */
  async acceptInvite(token: string, userId: string) {
    // Find pending invitation by token
    const invitation = await Invitation.findOne({
      token,
      status: "pending"
    })
      .populate("workspaceId", "name members")
      .populate("invitedBy", "name email");

    if (!invitation) {
      throw new AppError("Invalid or expired invitation", 404);
    }

    // Validate expiry
    if (new Date() > invitation.expiresAt) {
      invitation.status = "expired";
      await invitation.save();
      throw new AppError("This invitation has expired", 400);
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Verify email matches (case-insensitive) — only for email-type invites
    // Link-type invites have no email, so skip this check
    if (invitation.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AppError(
        "This invitation was sent to a different email address",
        403
      );
    }

    // Get workspace
    const workspace = await Workspace.findOne({
      _id: invitation.workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found or has been deleted", 404);
    }

    // Check if user is already a member
    const isAlreadyMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isAlreadyMember) {
      // Add user to workspace members using $push
      await Workspace.findByIdAndUpdate(
        workspace._id,
        {
          $push: {
            members: {
              user: userId,
              role: invitation.role,
              status: "inactive"  // New members start clocked out by default
            }
          }
        },
        { returnDocument: "after" }
      );
      console.log(`[InvitationService] Added user ${userId} to workspace ${workspace._id}`);
    } else {
      console.log(`[InvitationService] User ${userId} is already a member of workspace ${workspace._id} — proceeding to space provisioning`);
    }

    // Mark invitation as accepted
    invitation.status = "accepted";
    await invitation.save();

    // --- Fast-Pass: auto-provision user into attached space ---
    let joinedSpace: any = null;
    if (invitation.spaceId) {
      try {
        const Space = require("../models/Space");
        const space = await Space.findOne({ _id: invitation.spaceId, isDeleted: false });
        if (space) {
          // Check if user is already in the space
          const alreadyInSpace = space.members.some(
            (m: any) => m.user.toString() === userId
          );
          if (!alreadyInSpace) {
            const permissionLevel = invitation.spacePermissionLevel || "EDIT";
            const role = permissionLevel === "FULL" ? "admin" : "member";
            console.log(`[InvitationService] Auto-provisioning user ${userId} into space ${space._id} with level: ${permissionLevel}, role: ${role}`);
            
            space.members.push({ user: userId, role, permissionLevel });
            await space.save();

            // Sync SpaceMember collection
            const SpaceMember = require("../models/SpaceMember");
            await SpaceMember.findOneAndUpdate(
              { space: space._id, user: userId },
              { workspace: workspace._id, permissionLevel, addedBy: workspace.owner },
              { upsert: true, new: true }
            );

            console.log(`[InvitationService] Successfully provisioned user ${userId} into space ${space._id}`);
          }
          joinedSpace = space;
        } else {
          console.warn(`[InvitationService] Space ${invitation.spaceId} not found or deleted — skipping space provisioning`);
        }
      } catch (spaceError) {
        // Don't fail the workspace join if space provisioning fails
        console.error(`[InvitationService] Space provisioning failed, workspace join still succeeded:`, spaceError);
      }
    }

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId: workspace._id.toString(),
      action: "UPDATE",
      resourceType: "Workspace",
      resourceId: workspace._id.toString(),
      metadata: {
        action: "member_joined",
        role: invitation.role,
        invitationId: invitation._id
      }
    });

    // Create workspace activity
    await WorkspaceActivity.createActivity({
      workspace: workspace._id.toString(),
      user: userId,
      type: "member_joined",
      description: `joined the workspace`,
      targetUser: userId,
      metadata: { role: invitation.role }
    });

    // Send push notification to workspace owner (non-blocking)
    try {
      notificationService.createNotification({
        recipientId: workspace.owner.toString(),
        type: "INVITE_ACCEPTED",
        title: "Invitation Accepted",
        body: `${user.name} joined ${workspace.name}`,
        data: {
          resourceId: workspace._id.toString(),
          resourceType: "Workspace",
          workspaceId: workspace._id.toString(),
        },
      }).catch((error: any) => {
        console.error("Failed to send invitation accepted notification:", error);
      });
    } catch (error) {
      console.error("Failed to send invitation accepted notification:", error);
    }

    // Return workspace details
    const updatedWorkspace = await Workspace.findById(workspace._id)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    return {
      workspace: updatedWorkspace,
      role: invitation.role,
      spaceId: joinedSpace?._id?.toString() || null,
      spaceName: joinedSpace?.name || null,
      spacePermissionLevel: joinedSpace ? (invitation.spacePermissionLevel || "EDIT") : null
    };
  }

  /**
   * Get all pending invitations for a workspace
   */
  async getWorkspaceInvitations(workspaceId: string) {
    const invitations = await Invitation.find({
      workspaceId,
      status: "pending",
      expiresAt: { $gt: new Date() }
    })
      .populate("invitedBy", "name email")
      .sort("-createdAt");

    return invitations;
  }

  /**
   * Cancel/revoke an invitation
   */
  async cancelInvitation(invitationId: string, userId: string, workspaceId: string) {
    const invitation = await Invitation.findOne({
      _id: invitationId,
      workspaceId,
      status: "pending"
    });

    if (!invitation) {
      throw new AppError("Invitation not found", 404);
    }

    // Mark as expired instead of deleting (for audit trail)
    invitation.status = "expired";
    await invitation.save();

    // Log activity
    await logger.logActivity({
      userId,
      workspaceId,
      action: "DELETE",
      resourceType: "Workspace",
      resourceId: workspaceId,
      metadata: {
        action: "invitation_cancelled",
        invitationId: invitation._id,
        email: invitation.email
      }
    });

    return { message: "Invitation cancelled successfully" };
  }

  /**
   * Get user's pending invitations
   */
  async getUserInvitations(userEmail: string) {
    const invitations = await Invitation.find({
      email: userEmail.toLowerCase(),
      status: "pending",
      expiresAt: { $gt: new Date() }
    })
      .populate("workspaceId", "name")
      .populate("invitedBy", "name email")
      .sort("-createdAt");

    return invitations;
  }

  /**
   * Verify invitation token (public endpoint)
   */
  async verifyInvitation(token: string) {
    console.log(`[Verify Invitation] Checking token: ${token.substring(0, 10)}...`);
    
    // Find invitation by token (check all statuses first for debugging)
    const anyInvitation = await Invitation.findOne({ token });
    
    if (anyInvitation) {
      console.log(`[Verify Invitation] Found invitation with status: ${anyInvitation.status}`);
      console.log(`[Verify Invitation] Expires at: ${anyInvitation.expiresAt}`);
      console.log(`[Verify Invitation] Current time: ${new Date()}`);
    } else {
      console.log(`[Verify Invitation] No invitation found with this token`);
    }
    
    // Find invitation by token with pending status
    const invitation = await Invitation.findOne({
      token,
      status: "pending"
    })
      .populate("workspaceId", "name")
      .populate("invitedBy", "name email");

    if (!invitation) {
      console.log(`[Verify Invitation] No pending invitation found`);
      throw new AppError("Invitation invalid or expired", 400);
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      console.log(`[Verify Invitation] Invitation has expired`);
      throw new AppError("Invitation invalid or expired", 400);
    }

    console.log(`[Verify Invitation] Invitation is valid`);

    // Fetch space name if attached
    let spaceName: string | null = null;
    if (invitation.spaceId) {
      try {
        const Space = require("../models/Space");
        const space = await Space.findById(invitation.spaceId).select("name").lean();
        spaceName = space?.name || null;
      } catch (_) {}
    }
    
    // Return invitation details (including fast-pass fields)
    return {
      workspaceName: (invitation.workspaceId as any).name,
      inviterName: (invitation.invitedBy as any).name,
      email: invitation.email,
      role: invitation.role,
      inviteType: invitation.inviteType || "email",
      spaceId: invitation.spaceId?.toString() || null,
      spaceName,
      spacePermissionLevel: invitation.spacePermissionLevel || null
    };
  }

  /**
   * Redeem an invitation by short code (mobile / in-app flow)
   * Finds the invitation by shortCode then delegates to acceptInvite
   */
  async redeemByShortCode(shortCode: string, userId: string) {
    // Normalise — strip spaces and uppercase
    const code = shortCode.trim().toUpperCase();

    const invitation = await Invitation.findOne({
      shortCode: code,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      throw new AppError("Invalid or expired invite code", 404);
    }

    // Delegate to the existing acceptInvite method using the full token
    return this.acceptInvite(invitation.token, userId);
  }
}

module.exports = new InvitationService();

export {};
