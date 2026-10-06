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
  private async applyRequestFilters(
    filter: any,
    query: any,
    options: { allowStatus?: boolean; allowUser?: boolean } = {},
  ) {
    const allowStatus = options.allowStatus !== false;
    const allowUser = options.allowUser !== false;
    if (allowStatus && query.status && !["pending", "approved", "denied", "expired"].includes(String(query.status))) {
      throw new AppError("Invalid leave request status filter", 400);
    }
    if (allowStatus && ["pending", "approved", "denied", "expired"].includes(String(query.status))) {
      filter.status = query.status;
    }
    if (query.requestType && !["leave", "remote"].includes(String(query.requestType))) {
      throw new AppError("Invalid request type filter", 400);
    }
    if (["leave", "remote"].includes(String(query.requestType))) {
      filter.requestType = query.requestType;
    }
    const userId = query.userId || query.requesterId;
    if (allowUser && userId) {
      if (!Types.ObjectId.isValid(String(userId))) throw new AppError("Invalid member filter", 400);
      filter.requester = userId;
    }

    const fromValue = query.from || query.startDate;
    const toValue = query.to || query.endDate;
    const fromDate = fromValue ? new Date(`${String(fromValue).slice(0, 10)}T00:00:00.000Z`) : null;
    const toDate = toValue ? new Date(`${String(toValue).slice(0, 10)}T23:59:59.999Z`) : null;
    if (fromValue && (!fromDate || Number.isNaN(fromDate.getTime()))) {
      throw new AppError("Invalid start date filter", 400);
    }
    if (toValue && (!toDate || Number.isNaN(toDate.getTime()))) {
      throw new AppError("Invalid end date filter", 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new AppError("Start date filter must not be after end date", 400);
    }
    if (fromDate) {
      filter.endDate = { ...(filter.endDate || {}), $gte: fromDate };
    }
    if (toDate) {
      filter.startDate = { ...(filter.startDate || {}), $lte: toDate };
    }

    const search = String(query.search || query.q || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escaped, "i");
      const matchingUsers = await User.find({ $or: [{ name: expression }, { email: expression }] }).select("_id");
      filter.$or = [
        { reason: expression },
        { requester: { $in: matchingUsers.map((user: any) => user._id) } },
      ];
    }
    return filter;
  }

  private async emitDirectMessageEvent(event: string, leave: any, dm: any) {
    if (!leave.conversation || !dm) return;
    let conversationParticipants: any[] = [];
    try {
      const conversation = await Conversation.findById(leave.conversation).select("participants").lean();
      conversationParticipants = conversation?.participants || [];
    } catch (error) {
      console.error("[LeaveService] Failed to read DM participants for status event:", error);
    }
    const participantIds = [leave.requester, leave.assignedManager, ...conversationParticipants]
      .map((value: any) => value?._id?.toString?.() || value?.toString?.())
      .filter((value: string | undefined): value is string => Boolean(value));
    const uniqueParticipants = Array.from(new Set(participantIds));
    const message = typeof dm.toObject === "function" ? dm.toObject() : dm;
    socketService.emitToUsers?.(uniqueParticipants, event, {
      conversationId: leave.conversation.toString(),
      message: { ...message, conversation: leave.conversation.toString() },
    });
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

    if (requestType === "leave") {
      const requestedStart = new Date(start);
      requestedStart.setUTCHours(0, 0, 0, 0);
      const requestedEnd = new Date(end);
      requestedEnd.setUTCHours(23, 59, 59, 999);
      const overlappingApprovedLeave = await LeaveRequest.findOne({
        workspace: workspaceId,
        requester: requesterId,
        requestType: { $ne: "remote" },
        status: "approved",
        startDate: { $lte: requestedEnd },
        endDate: { $gte: requestedStart },
      }).select("_id startDate endDate");

      if (overlappingApprovedLeave) {
        throw new AppError("You already have approved leave during the requested dates", 409);
      }
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

      // DM clients subscribe to their personal socket rooms; conversation rooms
      // are not joined by every client, so deliver to both participants.
      try {
        await this.emitDirectMessageEvent("dm:new", leave, dm);
      } catch (err) {
        console.error("[LeaveService] Failed to emit DM message socket:", err);
      }
    }

    await leave.populate("requester", "name email avatar profilePicture");
    await leave.populate("assignedManager", "name email avatar profilePicture");

    try {
      const managerIds = await this.getLeaveManagersForWorkspace(workspaceId);
      await enhancedNotificationService.notifyLeaveRequested(leave, workspace, managerIds);
    } catch (err) {
      console.error("[LeaveService] Failed to notify request reviewers:", err);
    }

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
      throw new AppError(`Leave request has already been ${leave.status}`, 409);
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

        try {
          await dm.populate("sender", "name email avatar profilePicture");
          await this.emitDirectMessageEvent("dm:updated", leave, dm);
        } catch (err) {
          console.error("[LeaveService] Failed to emit DM update socket:", err);
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
      throw new AppError(`Leave request has already been ${leave.status}`, 409);
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

        try {
          await dm.populate("sender", "name email avatar profilePicture");
          await this.emitDirectMessageEvent("dm:updated", leave, dm);
        } catch (err) {
          console.error("[LeaveService] Failed to emit DM update socket:", err);
        }
      }
    }

    // Notify the requester and authorized reviewers so every manager sees the resolution.
    const workspace = await Workspace.findById(leave.workspace);
    if (workspace) {
      const managerIds = await this.getLeaveManagersForWorkspace(workspace._id.toString());
      await enhancedNotificationService.notifyLeaveDenied(leave, denier, workspace, managerIds);
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

  /** Get workspace leave and remote history with server-side filters and paging. */
  async getWorkspaceLeaves(workspaceId: string, query: any = {}) {
    const filter: any = { workspace: workspaceId };

    if (query.month && query.year) {
      const month = parseInt(query.month, 10) - 1;
      const year = parseInt(query.year, 10);
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      filter.startDate = { $lte: endOfMonth };
      filter.endDate = { $gte: startOfMonth };
    }
    await this.applyRequestFilters(filter, query);

    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(query.pageSize ?? query.limit) || 10)));
    const total = await LeaveRequest.countDocuments(filter);
    const requests = await LeaveRequest.find(filter)
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .populate("approvedBy", "name email avatar profilePicture")
      .populate("deniedBy", "name email avatar profilePicture")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    const totalPages = Math.ceil(total / pageSize);
    return {
      requests,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
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

  async getMyRequests(workspaceId: string, actorId: string, page = 1, limit = 10, query: any = {}) {
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)));
    const filter = await this.applyRequestFilters(
      { workspace: workspaceId, requester: actorId },
      query,
      { allowStatus: true, allowUser: false },
    );
    const total = await LeaveRequest.countDocuments(filter);
    const requests = await LeaveRequest.find(filter)
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .populate("approvedBy", "name email avatar profilePicture")
      .populate("deniedBy", "name email avatar profilePicture")
      .sort({ createdAt: -1, _id: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit);

    const totalPages = Math.ceil(total / normalizedLimit);
    return {
      requests,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedLimit,
        total,
        totalPages,
        hasMore: normalizedPage < totalPages,
      },
    };
  }

  async getReviewInbox(workspaceId: string, actorId: string, page = 1, limit = 10, query: any = {}) {
    const workspace = await Workspace.findById(workspaceId).select("owner");
    if (!workspace) throw new AppError("Workspace not found", 404);
    const isOwner = workspace.owner?.toString() === actorId.toString();
    const canManage = (await permissionService.can(actorId, "MANAGE_LEAVES_AND_REMOTE", { workspaceId, userId: actorId })) ||
      (await permissionService.can(actorId, "MANAGE_LEAVES", { workspaceId, userId: actorId }));
    if (!isOwner && !canManage) throw new AppError("You do not have permission to review leave and remote requests", 403);

    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const normalizedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)));
    const filter = await this.applyRequestFilters({
      workspace: workspaceId,
      status: "pending",
      ...(isOwner ? {} : { assignedManager: actorId }),
    }, query, { allowStatus: false, allowUser: true });
    const total = await LeaveRequest.countDocuments(filter);
    const requests = await LeaveRequest.find(filter)
      .populate("requester", "name email avatar profilePicture")
      .populate("assignedManager", "name email avatar profilePicture")
      .sort({ createdAt: -1, _id: -1 })
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit);

    const totalPages = Math.ceil(total / normalizedLimit);
    return {
      requests,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedLimit,
        total,
        totalPages,
        hasMore: normalizedPage < totalPages,
      },
    };
  }
}

const leaveService = new LeaveService();
module.exports = leaveService;
export default leaveService;
