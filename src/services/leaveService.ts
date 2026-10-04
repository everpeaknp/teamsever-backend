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
const { getWorkspaceTimezone, workspaceCalendarDateKey, isRequestExpired } = require("./workspaceCalendar");

class LeaveService {
  async expireWorkspaceRequests(workspaceId: string, now = new Date()): Promise<number> {
    // A few older unit-test doubles expose only findOne. Production Mongoose
    // always provides find; missing test-double capabilities mean no sweep.
    if (typeof LeaveRequest.find !== "function" || typeof LeaveRequest.findOneAndUpdate !== "function") return 0;
    const timezone = await getWorkspaceTimezone(workspaceId);
    const today = workspaceCalendarDateKey(now, timezone);
    const cutoff = new Date(`${today}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + 1);
    const candidates = await LeaveRequest.find({ workspace: workspaceId, status: "pending", endDate: { $lt: cutoff } });
    let expired = 0;
    for (const candidate of candidates) {
      const updated = await LeaveRequest.findOneAndUpdate(
        { _id: candidate._id, status: "pending", endDate: { $lt: cutoff } },
        { $set: { status: "expired", expiredAt: now } },
        { new: true }
      );
      if (!updated) continue;
      expired += 1;
      if (updated.directMessageId) {
        const dm = await DirectMessage.findById(updated.directMessageId);
        if (dm) {
          dm.metadata = { ...dm.metadata, status: "expired", expiredAt: now };
          await dm.save();
          if (updated.conversation) {
            try {
              const io = socketService.getIO();
              io?.to(`conversation:${updated.conversation.toString()}`).emit("dm:updated", {
                conversationId: updated.conversation.toString(), message: dm,
              });
            } catch (err) { console.error("[LeaveService] Failed to emit expired DM update:", err); }
          }
        }
      }
    }
    return expired;
  }

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

    await this.expireWorkspaceRequests(workspaceId);

    // members.privateRemoteAreas is select:false. Selecting it with the
    // members.* inclusion list creates a Mongo projection path collision on
    // the nested members array, so request the hidden field as an override and
    // let the schema's normal projection include the other member fields.
    const workspace = await Workspace.findById(workspaceId).select("+members.privateRemoteAreas");
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
      // The requester proposes a private place, but it is not added to the
      // workspace member until this assigned approver approves the request.
      // MANAGE_LEAVES authorizes that decision; requiring the separate address
      // management permission made normal assigned approvers unable to process
      // remote requests.
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
    await this.expireWorkspaceRequests(workspaceId);
    let leave: any = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture");

    if (!leave) {
      throw new AppError("Leave request not found", 404);
    }

    await this.assertCanDecideLeave(leave, approverId, workspaceId);

    if (leave.status !== "pending") {
      throw new AppError(`Leave request has already been ${leave.status}`, leave.status === "expired" ? 409 : 400);
    }

    const timezone = await getWorkspaceTimezone(workspaceId);
    if (isRequestExpired(leave.endDate, new Date(), timezone)) {
      await this.expireWorkspaceRequests(workspaceId);
      throw new AppError("This request has expired and can no longer be approved", 409);
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
          if (!currentRequest || currentRequest.status !== "pending" || isRequestExpired(currentRequest.endDate, new Date(), timezone)) throw new AppError("Remote request is no longer pending or has expired", 409);
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
      const approvedAt = new Date();
      const date = workspaceCalendarDateKey(approvedAt, timezone);
      const cutoff = new Date(`${date}T00:00:00.000Z`);
      cutoff.setUTCDate(cutoff.getUTCDate() + 1);
      const updated = await LeaveRequest.findOneAndUpdate(
        { _id: leaveId, workspace: workspaceId, status: "pending", endDate: { $gte: cutoff } },
        { $set: { status: "approved", approvedBy: approverId, approvedAt } },
        { new: true }
      );
      if (!updated) {
        await this.expireWorkspaceRequests(workspaceId);
        throw new AppError("This request is no longer pending or has expired", 409);
      }
      leave = updated;
      await leave.populate("requester", "name email avatar profilePicture");
      await leave.populate("assignedManager", "name email avatar profilePicture");
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
    await this.expireWorkspaceRequests(workspaceId);
    const leave = await LeaveRequest.findOne({ _id: leaveId, workspace: workspaceId })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture");

    if (!leave) {
      throw new AppError("Leave request not found", 404);
    }

    await this.assertCanDecideLeave(leave, denierId, workspaceId);

    if (leave.status !== "pending") {
      throw new AppError(`Leave request has already been ${leave.status}`, leave.status === "expired" ? 409 : 400);
    }

    const timezone = await getWorkspaceTimezone(workspaceId);
    if (isRequestExpired(leave.endDate, new Date(), timezone)) {
      await this.expireWorkspaceRequests(workspaceId);
      throw new AppError("This request has expired and can no longer be denied", 409);
    }

    const denier = await User.findById(denierId).select("name email avatar profilePicture");
    if (!denier) {
      throw new AppError("Denier user not found", 404);
    }

    const deniedAt = new Date();
    const date = workspaceCalendarDateKey(deniedAt, timezone);
    const cutoff = new Date(`${date}T00:00:00.000Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() + 1);
    const updated = await LeaveRequest.findOneAndUpdate(
      { _id: leaveId, workspace: workspaceId, status: "pending", endDate: { $gte: cutoff } },
      { $set: { status: "denied", deniedBy: denierId, deniedAt, denialReason: denialReason ? denialReason.trim() : null } },
      { new: true }
    );
    if (!updated) {
      await this.expireWorkspaceRequests(workspaceId);
      throw new AppError("This request is no longer pending or has expired", 409);
    }
    Object.assign(leave, updated.toObject());

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
    await this.expireWorkspaceRequests(workspaceId);
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
    await this.expireWorkspaceRequests(workspaceId);
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

  async getMyRequests(workspaceId: string, requesterId: string) {
    await this.expireWorkspaceRequests(workspaceId);
    return LeaveRequest.find({ workspace: workspaceId, requester: requesterId })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .sort({ createdAt: -1 });
  }

  async getAssignedInbox(workspaceId: string, actorId: string) {
    await this.expireWorkspaceRequests(workspaceId);
    const workspace = await Workspace.findById(workspaceId).select("owner");
    if (!workspace) throw new AppError("Workspace not found", 404);
    const isOwner = workspace.owner?.toString() === actorId;
    const canManage = (await permissionService.can(actorId, "MANAGE_LEAVES_AND_REMOTE", { workspaceId, userId: actorId })) || (await permissionService.can(actorId, "MANAGE_LEAVES", { workspaceId, userId: actorId }));
    if (!isOwner && !canManage) throw new AppError("You do not have permission to review leave and remote requests", 403);
    return LeaveRequest.find({ workspace: workspaceId, status: "pending", ...(isOwner ? {} : { assignedManager: actorId }) })
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .sort({ createdAt: -1 });
  }

  async expireAllPendingRequests(): Promise<number> {
    const workspaces = await Workspace.find({ isDeleted: false }).select("_id").lean();
    let total = 0;
    for (const workspace of workspaces) total += await this.expireWorkspaceRequests(String(workspace._id));
    return total;
  }
}

const leaveService = new LeaveService();
module.exports = leaveService;
export default leaveService;
