"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const Invitation = require("../models/Invitation");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const emailService = require("./emailService");
const notificationService = require("./notificationService");
class InvitationService {
    /**
     * Send invitation to join workspace
     */
    async sendInvite(data) {
        const { email, workspaceId, role, invitedBy } = data;
        // Verify workspace exists and is not deleted
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Check if user is already a member
        const existingMember = workspace.members.find((member) => member.user && member.user.toString() === invitedBy);
        if (!existingMember) {
            throw new AppError("You are not a member of this workspace", 403);
        }
        // Check if email is already a member (by finding user with this email)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            const isAlreadyMember = workspace.members.some((member) => member.user.toString() === existingUser._id.toString());
            if (isAlreadyMember) {
                throw new AppError("User is already a member of this workspace", 400);
            }
        }
        // Check for existing pending invitation
        const existingInvite = await Invitation.findOne({
            email: email.toLowerCase(),
            workspaceId,
            status: "pending",
            expiresAt: { $gt: new Date() }
        });
        // If there's an existing pending invitation, just resend the email with the same token
        if (existingInvite) {
            console.log(`Found existing invitation for ${email} to workspace ${workspaceId}, resending email`);
            // Populate invitation details for email
            await existingInvite.populate("invitedBy", "name email");
            await existingInvite.populate("workspaceId", "name");
            // Resend invitation email (non-blocking)
            setImmediate(async () => {
                try {
                    const inviter = await User.findById(invitedBy);
                    if (inviter) {
                        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                        const inviteUrl = `${frontendUrl}/join?token=${existingInvite.token}`;
                        await emailService.sendWorkspaceInvitation({
                            recipientEmail: email,
                            recipientName: email.split('@')[0],
                            inviterName: inviter.name,
                            workspaceName: workspace.name,
                            role: role,
                            workspaceLink: inviteUrl
                        });
                        console.log(`Re-sent invitation email to ${email} for workspace ${workspace.name}`);
                        // Re-send in-app notification if user is registered
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
                        }
                    }
                }
                catch (emailError) {
                    console.error("Failed to resend invitation email/notification:", emailError);
                }
            });
            return existingInvite;
        }
        // Generate secure token
        const token = crypto.randomBytes(32).toString("hex");
        // Set expiry to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // Create invitation
        const invitation = await Invitation.create({
            email: email.toLowerCase(),
            workspaceId,
            role,
            invitedBy,
            token,
            expiresAt
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
        // Create notification for invited user (if they have an account)
        try {
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                const inviter = await User.findById(invitedBy);
                const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                await notificationService.createNotification({
                    recipientId: existingUser._id.toString(),
                    type: "INVITATION",
                    title: "Workspace Invitation",
                    body: `${inviter?.name || 'Someone'} invited you to join ${workspace.name}`,
                    data: {
                        workspaceId,
                        token,
                        inviteUrl: `${frontendUrl}/join?token=${token}`,
                        workspaceName: workspace.name,
                        inviterName: inviter?.name,
                    },
                });
            }
        }
        catch (error) {
            console.error("Failed to create invitation notification:", error);
        }
        // Send invitation email in the background (truly non-blocking)
        // We do NOT await this — the invitation response returns immediately
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
            }
            catch (emailError) {
                console.error("Failed to send invitation email:", emailError);
            }
        });
        return invitation;
    }
    /**
     * Accept invitation and join workspace
     */
    async acceptInvite(token, userId) {
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
        // Verify email matches (case-insensitive)
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new AppError("This invitation was sent to a different email address", 403);
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
        const isAlreadyMember = workspace.members.some((member) => member.user.toString() === userId);
        if (isAlreadyMember) {
            // User is already a member - return workspace info instead of error
            const existingWorkspace = await Workspace.findById(workspace._id)
                .populate("owner", "name email")
                .populate("members.user", "name email");
            const userMember = workspace.members.find((member) => member.user.toString() === userId);
            return {
                workspace: existingWorkspace,
                role: userMember.role,
                alreadyMember: true
            };
        }
        // Add user to workspace members using $push
        await Workspace.findByIdAndUpdate(workspace._id, {
            $push: {
                members: {
                    user: userId,
                    role: invitation.role,
                    status: "inactive" // New members start clocked out by default
                }
            }
        }, { returnDocument: "after" });
        // Mark invitation as accepted
        invitation.status = "accepted";
        await invitation.save();
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
            }).catch((error) => {
                console.error("Failed to send invitation accepted notification:", error);
            });
        }
        catch (error) {
            console.error("Failed to send invitation accepted notification:", error);
        }
        // Return workspace details
        const updatedWorkspace = await Workspace.findById(workspace._id)
            .populate("owner", "name email")
            .populate("members.user", "name email");
        return {
            workspace: updatedWorkspace,
            role: invitation.role
        };
    }
    /**
     * Get all pending invitations for a workspace
     */
    async getWorkspaceInvitations(workspaceId) {
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
    async cancelInvitation(invitationId, userId, workspaceId) {
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
    async getUserInvitations(userEmail) {
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
    async verifyInvitation(token) {
        console.log(`[Verify Invitation] Checking token: ${token.substring(0, 10)}...`);
        // Find invitation by token (check all statuses first for debugging)
        const anyInvitation = await Invitation.findOne({ token });
        if (anyInvitation) {
            console.log(`[Verify Invitation] Found invitation with status: ${anyInvitation.status}`);
            console.log(`[Verify Invitation] Expires at: ${anyInvitation.expiresAt}`);
            console.log(`[Verify Invitation] Current time: ${new Date()}`);
        }
        else {
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
        console.log(`[Verify Invitation] Invitation is valid for ${invitation.email}`);
        // Return invitation details
        return {
            workspaceName: invitation.workspaceId.name,
            inviterName: invitation.invitedBy.name,
            email: invitation.email,
            role: invitation.role
        };
    }
}
module.exports = new InvitationService();
