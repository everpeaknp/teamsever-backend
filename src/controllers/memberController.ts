import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const emailService = require("../services/emailService");
const asyncHandler = require("../utils/asyncHandler");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const AppError = require("../utils/AppError");

/**
 * @desc    Get all members of a workspace
 * @route   GET /api/workspaces/:workspaceId/members
 * @access  Private (Member or higher)
 */
const getWorkspaceMembers = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('[MemberController] getWorkspaceMembers called', { workspaceId: req.params.workspaceId });
    
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId).populate(
      "members.user",
      "name email"
    );

    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    console.log('[MemberController] Workspace found:', {
      name: workspace.name,
      owner: workspace.owner,
      totalMembers: workspace.members.length,
      membersData: workspace.members.map((m: any) => ({
        userId: m.user?._id || m.user,
        role: m.role,
        status: m.status,
        hasUserData: !!m.user?.name
      }))
    });

    // Format response - return ALL members regardless of clock-in status
    // The status field is for time tracking (active/inactive = clocked in/out), not for member visibility
    const members = workspace.members
      .filter((member: any) => {
        // Only filter out if user data is missing (deleted users)
        const hasUserData = member.user && (member.user._id || member.user.name);
        console.log('[MemberController] Filtering member:', {
          userId: member.user?._id || member.user,
          role: member.role,
          status: member.status,
          hasUserData
        });
        return hasUserData;
      })
      .map((member: any) => ({
        _id: member.user._id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        status: member.status || 'inactive',
        isOwner: workspace.owner.toString() === member.user._id.toString(),
        customRoleTitle: member.customRoleTitle,
      }));

    console.log('[MemberController] Active members retrieved', { 
      count: members.length,
      totalMembers: workspace.members.length,
      members: members.map(m => ({ id: m._id, name: m.name, role: m.role }))
    });

    // If no members found but workspace has an owner, include the owner
    if (members.length === 0 && workspace.owner) {
      console.log('[MemberController] No members found, fetching owner');
      const owner = await User.findById(workspace.owner).select('name email');
      if (owner) {
        members.push({
          _id: owner._id,
          name: owner.name,
          email: owner.email,
          role: 'owner',
          status: 'active',
          isOwner: true,
        });
        console.log('[MemberController] Added owner to members list');
      }
    }

    res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  }
);

/**
 * @desc    Update member role
 * @route   PATCH /api/workspaces/:workspaceId/members/:userId
 * @access  Private (Owner only for role changes)
 */
const updateMemberRole = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId, userId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user!.id;

    // Validate role
    const validRoles = ["owner", "admin", "member", "guest"];
    if (!role || !validRoles.includes(role)) {
      return next(
        new AppError(
          `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          400
        )
      );
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    // Find the member to update
    const memberIndex = workspace.members.findIndex(
      (m: any) => m.user.toString() === userId
    );

    if (memberIndex === -1) {
      return next(new AppError("Member not found in workspace", 404));
    }

    // Check if trying to change owner role
    if (workspace.owner.toString() === userId && role !== "owner") {
      return next(
        new AppError(
          "Cannot change owner role. Transfer ownership first.",
          400
        )
      );
    }

    // Check if trying to make someone else owner
    if (role === "owner" && workspace.owner.toString() !== userId) {
      return next(
        new AppError(
          "Cannot assign owner role. Use transfer ownership endpoint.",
          400
        )
      );
    }

    // Prevent users from changing their own role
    if (userId === currentUserId) {
      return next(new AppError("Cannot change your own role", 400));
    }

    // Update the role
    workspace.members[memberIndex].role = role;
    await workspace.save();

    // Get updated member info
    const updatedWorkspace = await Workspace.findById(workspaceId).populate(
      "members.user",
      "name email"
    );

    const updatedMember = updatedWorkspace.members.find(
      (m: any) => m.user._id.toString() === userId
    );

    res.status(200).json({
      success: true,
      message: "Member role updated successfully",
      data: {
        _id: updatedMember.user._id,
        name: updatedMember.user.name,
        email: updatedMember.user.email,
        role: updatedMember.role,
        isOwner: workspace.owner.toString() === updatedMember.user._id.toString(),
      },
    });
  }
);

/**
 * @desc    Remove member from workspace
 * @route   DELETE /api/workspaces/:workspaceId/members/:userId
 * @access  Private (Admin or Owner)
 */
const removeMember = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId, userId } = req.params;
    const currentUserId = req.user!.id;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    // Cannot remove owner
    if (workspace.owner.toString() === userId) {
      return next(
        new AppError("Cannot remove workspace owner. Transfer ownership first.", 400)
      );
    }

    // Cannot remove yourself
    if (userId === currentUserId) {
      return next(new AppError("Cannot remove yourself. Use leave workspace instead.", 400));
    }

    // Find member
    const memberIndex = workspace.members.findIndex(
      (m: any) => m.user.toString() === userId
    );

    if (memberIndex === -1) {
      return next(new AppError("Member not found in workspace", 404));
    }

    // Actually remove the member from the array
    workspace.members.splice(memberIndex, 1);
    await workspace.save();

    console.log('[RemoveMember] Member removed from workspace:', userId);
    console.log('[RemoveMember] Remaining members:', workspace.members.length);

    // Emit socket event for real-time updates
    const io = require('../server').io;
    if (io) {
      io.to(workspaceId).emit('member:removed', {
        workspaceId,
        userId,
        removedBy: currentUserId
      });
    }

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  }
);

/**
 * @desc    Invite member to workspace
 * @route   POST /api/workspaces/:workspaceId/members/invite
 * @access  Private (Admin or Owner)
 */
const inviteMember = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const { email, role = "member" } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    // Validate role
    const validRoles = ["admin", "member", "guest"];
    if (!validRoles.includes(role)) {
      return next(
        new AppError(
          `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          400
        )
      );
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError("User not found with that email", 404));
    }

    // Check if user exists in members array
    const existingMemberIndex = workspace.members.findIndex(
      (m: any) => m.user.toString() === user._id.toString()
    );

    if (existingMemberIndex !== -1) {
      const existingMember = workspace.members[existingMemberIndex];
      
      // User is already a member of this workspace
      // Just update their role and resend invitation email
      console.log('[InviteMember] User already exists in workspace, updating role and resending invitation:', user.email);
      workspace.members[existingMemberIndex].role = role;
      await workspace.save();
      
      // Resend invitation email
      try {
        const inviter = await User.findById(req.user?.id);
        const workspaceLink = `${process.env.FRONTEND_URL}/workspace/${workspaceId}`;
        
        await emailService.sendWorkspaceInvitation({
          recipientEmail: user.email,
          recipientName: user.name,
          inviterName: inviter?.name || 'A team member',
          workspaceName: workspace.name,
          role: role,
          workspaceLink: workspaceLink
        });
        
        console.log('[InviteMember] Invitation email resent to:', user.email);
      } catch (emailError) {
        console.error('[InviteMember] Failed to send invitation email:', emailError);
        // Don't fail the invitation if email fails
      }
      
      return res.status(200).json({
        success: true,
        message: "Invitation resent successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: role,
          isOwner: false,
        },
      });
    }

    // Add new member
    workspace.members.push({
      user: user._id,
      role: role,
      status: 'inactive', // New members start clocked out by default
    });

    await workspace.save();

    console.log('[InviteMember] New member added:', user.email);
    console.log('[InviteMember] Active members:', workspace.members.filter((m: any) => m.status === 'active').length);

    // Send invitation email
    try {
      const inviter = await User.findById(req.user?.id);
      const workspaceLink = `${process.env.FRONTEND_URL}/workspace/${workspaceId}`;
      
      await emailService.sendWorkspaceInvitation({
        recipientEmail: user.email,
        recipientName: user.name,
        inviterName: inviter?.name || 'A team member',
        workspaceName: workspace.name,
        role: role,
        workspaceLink: workspaceLink
      });
      
      console.log('[InviteMember] Invitation email sent to:', user.email);
    } catch (emailError) {
      console.error('[InviteMember] Failed to send invitation email:', emailError);
      // Don't fail the invitation if email fails
    }

    res.status(200).json({
      success: true,
      message: "Member invited successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: role,
        isOwner: false,
      },
    });
  }
);

/**
 * @desc    Update current user's status (clock in/out)
 * @route   PATCH /api/workspaces/:workspaceId/members/me/status
 * @access  Private (Member)
 */
const updateMyStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const { status } = req.body;
    const currentUserId = req.user!.id;

    // Validate status
    const validStatuses = ["active", "inactive"];
    if (!status || !validStatuses.includes(status)) {
      return next(
        new AppError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          400
        )
      );
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    // Find the current user's member record
    const memberIndex = workspace.members.findIndex(
      (m: any) => m.user.toString() === currentUserId
    );

    if (memberIndex === -1) {
      return next(new AppError("You are not a member of this workspace", 404));
    }

    // Update the status
    workspace.members[memberIndex].status = status;
    await workspace.save();

    res.status(200).json({
      success: true,
      message: `Successfully ${status === 'active' ? 'clocked in' : 'clocked out'}`,
      data: {
        status: status,
      },
    });
  }
);

module.exports = {
  getWorkspaceMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  updateMyStatus,
};

export {};
