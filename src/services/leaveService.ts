import { Types } from "mongoose";

const LeaveRequest = require("../models/LeaveRequest");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const DirectMessage = require("../models/DirectMessage");
const Conversation = require("../models/Conversation");
const AppError = require("../utils/AppError");
const permissionService = require("../permissions/permission.service");
const enhancedNotificationService = require("./enhancedNotificationService").default || require("./enhancedNotificationService");
const socketService = require("./socketService").default || require("./socketService");

class LeaveService {
  /**
   * Helper: Get users in a workspace who have MANAGE_LEAVES permission
   */
  async getLeaveManagersForWorkspace(workspaceId: string): Promise<string[]> {
    const workspace = await Workspace.findById(workspaceId).populate("rolePermissionAdditions");
    if (!workspace) return [];

    const managerIds: string[] = [];

    // Owner always has MANAGE_LEAVES
    if (workspace.owner) {
      managerIds.push(workspace.owner.toString());
    }

    // Default roles that have MANAGE_LEAVES: owner, admin, operations_manager
    const defaultManagerRoles = ["owner", "admin", "operations_manager"];

    // Check custom roles or role permission additions
    for (const member of workspace.members || []) {
      const uId = member.user ? member.user.toString() : null;
      if (!uId) continue;

      if (defaultManagerRoles.includes(member.role)) {
        if (!member.restrictedPermissions?.includes("MANAGE_LEAVES")) {
          managerIds.push(uId);
          continue;
        }
      }

      // Explicitly added permission
      if (member.additionalPermissions?.includes("MANAGE_LEAVES")) {
        managerIds.push(uId);
        continue;
      }
    }

    return Array.from(new Set(managerIds));
  }

  /**
   * Calculate approved leave days for a user in a specific calendar month
   */
  async getMonthlyApprovedLeaveDays(workspaceId: string, userId: string, date: Date = new Date()): Promise<number> {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    const approvedLeaves = await LeaveRequest.find({
      workspace: workspaceId,
      requester: userId,
      status: "approved",
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { startDate: { $lte: startOfMonth }, endDate: { $gte: endOfMonth } },
      ],
    });

    let totalDays = 0;
    for (const leave of approvedLeaves) {
      totalDays += leave.daysCount || 0;
    }

    return totalDays;
  }

  /**
   * Request Leave (from DM or standalone)
   */
  async requestLeave({
    workspaceId,
    requesterId,
    assignedManagerId,
    conversationId,
    startDate,
    endDate,
    reason,
  }: {
    workspaceId: string;
    requesterId: string;
    assignedManagerId: string;
    conversationId?: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
  }) {
    if (!reason || !reason.trim()) {
      throw new AppError("Leave reason is compulsory and cannot be empty", 400);
    }

    const workspace = await Workspace.findById(workspaceId).select("owner members");
    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isWorkspaceMember = (userId: string) =>
      workspace.members?.some(
        (member: any) => member.user?.toString() === userId.toString() && member.status !== "inactive"
      ) || workspace.owner?.toString() === userId.toString();

    if (!isWorkspaceMember(requesterId)) {
      throw new AppError("Requester is not an active member of this workspace", 403);
    }

    if (!isWorkspaceMember(assignedManagerId)) {
      throw new AppError("Assigned approver must be an active member of this workspace", 400);
    }

    const assignedManagerCanManageLeaves = await permissionService.can(
      assignedManagerId,
      "MANAGE_LEAVES",
      { workspaceId, userId: assignedManagerId }
    );
    if (!assignedManagerCanManageLeaves) {
      throw new AppError("Assigned approver must have permission to manage leaves", 400);
    }

    if (conversationId) {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workspace: workspaceId,
        participants: { $all: [requesterId, assignedManagerId] },
      }).select("_id");
      if (!conversation) {
        throw new AppError("Conversation must be a direct message between the requester and assigned approver in this workspace", 400);
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid start or end date", 400);
    }

    if (end < start) {
      throw new AppError("End date cannot be earlier than start date", 400);
    }

    // Calculate days inclusive (1 day if same date)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // Calculate approved leave days already taken this month
    const approvedDaysThisMonth = await this.getMonthlyApprovedLeaveDays(workspaceId, requesterId, start);
    // Warning threshold: already had >= 2 days, or this request pushes over 2 days
    const isExceedingMonthlyQuota = approvedDaysThisMonth >= 2 || (approvedDaysThisMonth + daysCount) > 2;

    const leave = await LeaveRequest.create({
      workspace: workspaceId,
      requester: requesterId,
      assignedManager: assignedManagerId,
      conversation: conversationId || null,
      startDate: start,
      endDate: end,
      daysCount,
      reason: reason.trim(),
      status: "pending",
      isExceedingMonthlyQuota,
      monthlyLeaveCountAtRequest: approvedDaysThisMonth,
    });

    // If request was made inside a DM conversation, create the interactive DM message
    if (conversationId) {
      const dm = await DirectMessage.create({
        conversation: conversationId,
        sender: requesterId,
        type: "leave_request",
        content: `🌴 Leave Request: ${daysCount} day${daysCount > 1 ? "s" : ""} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})\nReason: ${reason.trim()}`,
        metadata: {
          leaveRequestId: leave._id,
          startDate: start,
          endDate: end,
          daysCount,
          reason: reason.trim(),
          status: "pending",
          isExceedingMonthlyQuota,
          monthlyLeaveCountAtRequest: approvedDaysThisMonth,
        },
        readBy: [requesterId],
      });

      leave.directMessageId = dm._id;
      await leave.save();

      // Update conversation lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: dm._id,
        lastMessageAt: new Date(),
      });

      await dm.populate("sender", "name email avatar profilePicture");

      // Realtime emit to DM conversation room
      try {
        const io = socketService.getIO();
        if (io) {
          io.to(`conversation:${conversationId}`).emit("dm:new", {
            conversationId,
            message: dm,
          });
        }
      } catch (err) {
        console.error("[LeaveService] Failed to emit DM message socket:", err);
      }
    }

    await leave.populate("requester", "name email avatar profilePicture");
    await leave.populate("assignedManager", "name email avatar profilePicture");

    return leave;
  }

  /**
   * Approve Leave
   */
  async approveLeave(leaveId: string, approverId: string, workspaceId: string) {
    const leave = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture");

    if (!leave) {
      throw new AppError("Leave request not found", 404);
    }

    await this.assertCanDecideLeave(leave, approverId, workspaceId);

    if (leave.status !== "pending") {
      throw new AppError(`Leave request has already been ${leave.status}`, 400);
    }

    const approver = await User.findById(approverId).select("name email avatar profilePicture");
    if (!approver) {
      throw new AppError("Approver user not found", 404);
    }

    leave.status = "approved";
    leave.approvedBy = approverId as any;
    leave.approvedAt = new Date();
    await leave.save();

    // If attached to a DM, update the DM card metadata live
    if (leave.directMessageId) {
      const dm = await DirectMessage.findById(leave.directMessageId);
      if (dm) {
        dm.metadata = {
          ...dm.metadata,
          status: "approved",
          approvedBy: {
            _id: approver._id,
            name: approver.name,
          },
          approvedAt: leave.approvedAt,
        };
        await dm.save();

        if (leave.conversation) {
          try {
            const io = socketService.getIO();
            if (io) {
              io.to(`conversation:${leave.conversation.toString()}`).emit("dm:updated", {
                conversationId: leave.conversation.toString(),
                message: dm,
              });
            }
          } catch (err) {
            console.error("[LeaveService] Failed to emit DM update socket:", err);
          }
        }
      }
    }

    // Notify requester + ALL managers with MANAGE_LEAVES (User C, etc.)
    const workspace = await Workspace.findById(leave.workspace);
    if (workspace) {
      const managerIds = await this.getLeaveManagersForWorkspace(workspace._id.toString());
      await enhancedNotificationService.notifyLeaveApproved(leave, approver, workspace, managerIds);
    }

    return leave;
  }

  /**
   * Deny Leave (denialReason is optional)
   */
  async denyLeave(leaveId: string, denierId: string, workspaceId: string, denialReason?: string) {
    const leave = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture");

    if (!leave) {
      throw new AppError("Leave request not found", 404);
    }

    await this.assertCanDecideLeave(leave, denierId, workspaceId);

    if (leave.status !== "pending") {
      throw new AppError(`Leave request has already been ${leave.status}`, 400);
    }

    const denier = await User.findById(denierId).select("name email avatar profilePicture");
    if (!denier) {
      throw new AppError("Denier user not found", 404);
    }

    leave.status = "denied";
    leave.deniedBy = denierId as any;
    leave.deniedAt = new Date();
    leave.denialReason = denialReason ? denialReason.trim() : null;
    await leave.save();

    // Update DM card metadata
    if (leave.directMessageId) {
      const dm = await DirectMessage.findById(leave.directMessageId);
      if (dm) {
        dm.metadata = {
          ...dm.metadata,
          status: "denied",
          deniedBy: {
            _id: denier._id,
            name: denier.name,
          },
          deniedAt: leave.deniedAt,
          denialReason: leave.denialReason,
        };
        await dm.save();

        if (leave.conversation) {
          try {
            const io = socketService.getIO();
            if (io) {
              io.to(`conversation:${leave.conversation.toString()}`).emit("dm:updated", {
                conversationId: leave.conversation.toString(),
                message: dm,
              });
            }
          } catch (err) {
            console.error("[LeaveService] Failed to emit DM update socket:", err);
          }
        }
      }
    }

    // Notify requester (as requested: do NOT spam other managers when denied)
    const workspace = await Workspace.findById(leave.workspace);
    if (workspace) {
      await enhancedNotificationService.notifyLeaveDenied(leave, denier, workspace);
    }

    return leave;
  }

  /** Only the assigned, currently authorized approver or the workspace owner may decide. */
  private async assertCanDecideLeave(leave: any, actorId: string, workspaceId: string) {
    const workspace = await Workspace.findById(workspaceId).select("owner");
    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isOwner = workspace.owner?.toString() === actorId.toString();
    if (isOwner) return;

    const assignedManagerId = leave.assignedManager?._id?.toString?.() || leave.assignedManager?.toString?.();
    const isAssignedManager = assignedManagerId === actorId.toString();
    if (!isAssignedManager) {
      throw new AppError("Only the assigned approver or workspace owner may decide this leave request", 403);
    }

    const canManageLeaves = await permissionService.can(
      actorId,
      "MANAGE_LEAVES",
      { workspaceId, userId: actorId }
    );
    if (!canManageLeaves) {
      throw new AppError("Assigned approver no longer has permission to manage leaves", 403);
    }
  }

  /**
   * Get workspace leaves with filters (status, month, user)
   */
  async getWorkspaceLeaves(workspaceId: string, query: any = {}) {
    const filter: any = { workspace: workspaceId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.userId) {
      filter.requester = query.userId;
    }

    if (query.month && query.year) {
      const month = parseInt(query.month, 10) - 1;
      const year = parseInt(query.year, 10);
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      filter.startDate = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const leaves = await LeaveRequest.find(filter)
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .populate("approvedBy", "name email avatar profilePicture")
      .populate("deniedBy", "name email avatar profilePicture")
      .sort({ startDate: -1 });

    return leaves;
  }

  /**
   * Get active leaves today (for "Who's on Leave Today" banner)
   */
  async getActiveLeavesToday(workspaceId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const activeLeaves = await LeaveRequest.find({
      workspace: workspaceId,
      status: "approved",
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
    }).populate("requester", "name email avatar profilePicture jobTitle department");

    return activeLeaves;
  }
}

const leaveService = new LeaveService();
module.exports = leaveService;
export default leaveService;
