import { Types } from "mongoose";
const mongoose = require("mongoose");

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
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return [];

    const managerIds: string[] = [];

    // Owner always has MANAGE_LEAVES
    if (workspace.owner) {
      managerIds.push(workspace.owner.toString());
    }

    for (const member of workspace.members || []) {
      const uId = member.user ? member.user.toString() : null;
      if (!uId || member.status === "inactive") continue;
      const canManage = (await permissionService.can(uId, "MANAGE_LEAVES_AND_REMOTE", { workspaceId, userId: uId })) || (await permissionService.can(uId, "MANAGE_LEAVES", { workspaceId, userId: uId }));
      if (canManage) managerIds.push(uId);
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
      requestType: { $ne: "remote" },
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
    requestType = "leave",
    remoteAreaId,
    proposedRemoteArea,
  }: {
    workspaceId: string;
    requesterId: string;
    assignedManagerId: string;
    conversationId?: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
    requestType?: "leave" | "remote";
    remoteAreaId?: string;
    proposedRemoteArea?: { name: string; latitude: number; longitude: number; radiusMeters?: number };
  }) {
    if (!reason || !reason.trim()) {
      throw new AppError("Leave reason is compulsory and cannot be empty", 400);
    }

    const workspace = await Workspace.findById(workspaceId).select("owner members +members.privateRemoteAreas");
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

    if (!["leave", "remote"].includes(requestType)) throw new AppError("Invalid request type", 400);
    if (requestType === "remote" && !conversationId) throw new AppError("Remote work requests must be submitted through the assigned manager DM", 400);
    const assignedManagerCanManageLeaves = (await permissionService.can(assignedManagerId, "MANAGE_LEAVES_AND_REMOTE", { workspaceId, userId: assignedManagerId })) || (await permissionService.can(assignedManagerId, "MANAGE_LEAVES", { workspaceId, userId: assignedManagerId }));
    if (!assignedManagerCanManageLeaves) {
      throw new AppError("Assigned approver must have permission to manage leave and remote requests", 400);
    }

    let requestedRemoteAreaName: string | undefined;
    if (requestType === "remote") {
      const requesterMember = workspace.members?.find((item: any) => item.user?.toString() === requesterId);
      if ((requesterMember?.attendanceMode || "onsite") !== "onsite") throw new AppError("Temporary remote requests are for on-site members; manage a permanent remote place in workspace location settings", 400);
      const existingArea = remoteAreaId && requesterMember?.privateRemoteAreas?.find((area: any) => String(area._id) === String(remoteAreaId) && area.isActive);
      if (existingArea) requestedRemoteAreaName = existingArea.name;
      if (!existingArea && !proposedRemoteArea) throw new AppError("Choose an approved private remote place or propose an address", 400);
      if (proposedRemoteArea && (typeof proposedRemoteArea.name !== "string" || !proposedRemoteArea.name.trim() || !Number.isFinite(proposedRemoteArea.latitude) || proposedRemoteArea.latitude < -90 || proposedRemoteArea.latitude > 90 || !Number.isFinite(proposedRemoteArea.longitude) || proposedRemoteArea.longitude < -180 || proposedRemoteArea.longitude > 180)) throw new AppError("A valid proposed remote address is required", 400);
      if (proposedRemoteArea) {
        const isOwner = workspace.owner?.toString() === assignedManagerId;
        const canManageAddresses = isOwner || (await permissionService.can(assignedManagerId, "MANAGE_ADDRESSES", { workspaceId, userId: assignedManagerId })) || (await permissionService.can(assignedManagerId, "MANAGE_ATTENDANCE_LOCATIONS", { workspaceId, userId: assignedManagerId }));
        if (!canManageAddresses) throw new AppError("Assigned approver must also have Manage Addresses permission for a new private place", 400);
      }
    }

    if (conversationId) {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        workspace: workspaceId,
        participants: { $all: [requesterId, assignedManagerId] },
      }).select("_id participants");
      if (!conversation || (conversation.participants || []).length !== 2) {
        throw new AppError("Conversation must be a private two-person DM between the requester and assigned approver in this workspace", 400);
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
      requestType,
      remoteAreaId: remoteAreaId || null,
      remoteAreaName: requestedRemoteAreaName || proposedRemoteArea?.name,
      proposedRemoteArea: requestType === "remote" ? proposedRemoteArea : undefined,
      isExceedingMonthlyQuota,
      monthlyLeaveCountAtRequest: approvedDaysThisMonth,
    });

    // If request was made inside a DM conversation, create the interactive DM message
    if (conversationId) {
      const dm = await DirectMessage.create({
        conversation: conversationId,
        sender: requesterId,
        type: "leave_request",
        content: requestType === "remote" ? `🏠 Remote Work Request: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\nReason: ${reason.trim()}` : `🌴 Leave Request: ${daysCount} day${daysCount > 1 ? "s" : ""} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})\nReason: ${reason.trim()}`,
        metadata: {
          leaveRequestId: leave._id,
          requestType,
          startDate: start,
          endDate: end,
          daysCount,
          reason: reason.trim(),
          ...(requestType === "remote" ? { remoteAreaId: leave.remoteAreaId?.toString?.(), remoteAreaName: leave.remoteAreaName, proposedRemoteArea: leave.proposedRemoteArea?.toObject?.() || leave.proposedRemoteArea } : {}),
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
    let leave: any = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId })
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

    if (leave.requestType === "remote") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const currentRequest = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId }).session(session);
          if (!currentRequest || currentRequest.status !== "pending") throw new AppError("Remote request is no longer pending", 409);
          const workspaceDoc = await Workspace.findById(workspaceId).select("+members.privateRemoteAreas +members.temporaryRemoteApprovals").session(session);
          const requesterId = currentRequest.requester.toString();
          const member = workspaceDoc?.members?.find((item: any) => item.user?.toString() === requesterId);
          if (!workspaceDoc || !member) throw new AppError("Remote request member not found in this workspace", 404);
          let area = currentRequest.remoteAreaId && member.privateRemoteAreas?.find((item: any) => String(item._id) === String(currentRequest.remoteAreaId) && item.isActive);
          if (!area && currentRequest.proposedRemoteArea) {
            member.privateRemoteAreas ||= [];
            member.privateRemoteAreas.push({ _id: new Types.ObjectId(), name: currentRequest.proposedRemoteArea.name, latitude: currentRequest.proposedRemoteArea.latitude, longitude: currentRequest.proposedRemoteArea.longitude, radiusMeters: currentRequest.proposedRemoteArea.radiusMeters || 60, isActive: true });
            area = member.privateRemoteAreas[member.privateRemoteAreas.length - 1];
          }
          if (!area) throw new AppError("The requested private remote place is no longer active", 409);
          member.temporaryRemoteApprovals ||= [];
          member.temporaryRemoteApprovals.push({ areaId: area._id, startDate: currentRequest.startDate, endDate: currentRequest.endDate, requestId: currentRequest._id });
          currentRequest.remoteAreaId = area._id;
          currentRequest.status = "approved";
          currentRequest.approvedBy = approverId as any;
          currentRequest.approvedAt = new Date();
          workspaceDoc.markModified("members");
          await workspaceDoc.save({ session });
          await currentRequest.save({ session });
          leave = currentRequest;
        });
      } finally { await session.endSession(); }
      await leave.populate("requester", "name email avatar profilePicture");
      await leave.populate("assignedManager", "name email avatar profilePicture");
    } else {
      leave.status = "approved";
      leave.approvedBy = approverId as any;
      leave.approvedAt = new Date();
      await leave.save();
    }

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

    const canManageLeaves = (await permissionService.can(
      actorId,
      "MANAGE_LEAVES_AND_REMOTE",
      { workspaceId, userId: actorId }
    )) || (await permissionService.can(actorId, "MANAGE_LEAVES", { workspaceId, userId: actorId }));
    if (!canManageLeaves) {
      throw new AppError("Assigned approver no longer has permission to manage leaves", 403);
    }
  }

  /**
   * Get workspace leaves with filters (status, month, user)
   */
  async getWorkspaceLeaves(workspaceId: string, query: any = {}) {
    const filter: any = { workspace: workspaceId, requestType: { $ne: "remote" } };

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
      requestType: { $ne: "remote" },
      status: "approved",
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
    }).populate("requester", "name email avatar profilePicture jobTitle department");

    return activeLeaves;
  }

  async getRemoteRequests(workspaceId: string, actorId: string) {
    const workspace = await Workspace.findById(workspaceId).select("owner");
    if (!workspace) throw new AppError("Workspace not found", 404);
    const isOwner = workspace.owner?.toString() === actorId;
    const canManage = (await permissionService.can(actorId, "MANAGE_LEAVES_AND_REMOTE", { workspaceId, userId: actorId })) || (await permissionService.can(actorId, "MANAGE_LEAVES", { workspaceId, userId: actorId }));
    if (!isOwner && !canManage) throw new AppError("You do not have permission to review remote requests", 403);
    return LeaveRequest.find({ workspace: workspaceId, requestType: "remote", status: "pending", ...(isOwner ? {} : { assignedManager: actorId }) })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .sort({ createdAt: -1 });
  }
}

const leaveService = new LeaveService();
module.exports = leaveService;
export default leaveService;
