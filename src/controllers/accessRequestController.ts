import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const AccessRequest = require("../models/AccessRequest");
const Workspace = require("../models/Workspace");
const User = require("../models/User");
const notificationService = require("../services/enhancedNotificationService");

// ---------------------------------------------------------------------------
// POST /api/workspaces/:workspaceId/access-requests
// Any authenticated user who is NOT already a member submits a request.
// ---------------------------------------------------------------------------
const createAccessRequest = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const userId = req.user!.id;
    const { requestedRole = "member", message = "" } = req.body;

    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
    if (!workspace) return next(new AppError("Workspace not found", 404));

    // User must not already be a member
    const alreadyMember = workspace.members.some(
      (m: any) => m.user.toString() === userId
    );
    if (alreadyMember) {
      return next(new AppError("You are already a member of this workspace", 400));
    }

    // Block if a pending request already exists
    const existing = await AccessRequest.findOne({
      workspace: workspaceId,
      requester: userId,
      status: "pending",
    });
    if (existing) {
      return next(
        new AppError("You already have a pending access request for this workspace", 400)
      );
    }

    const accessRequest = await AccessRequest.create({
      workspace: workspaceId,
      requester: userId,
      requestedRole,
      message: message.trim(),
    });

    // Notify workspace owner
    const requester = await User.findById(userId).select("name email");
    const ownerId = workspace.owner.toString();

    await notificationService.createNotification({
      recipientId: ownerId,
      type: "ACCESS_REQUEST",
      title: "New Access Request",
      body: `${requester.name} requested ${requestedRole} access to ${workspace.name}`,
      data: {
        workspaceId,
        requestId: accessRequest._id.toString(),
        requestedRole,
        requesterName: requester.name,
        requesterEmail: requester.email,
        resourceType: "AccessRequest",
      },
    });

    res.status(201).json({
      success: true,
      message: "Access request submitted. The workspace owner has been notified.",
      data: {
        _id: accessRequest._id,
        requestedRole: accessRequest.requestedRole,
        message: accessRequest.message,
        status: accessRequest.status,
        createdAt: accessRequest.createdAt,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/access-requests
// Owner/admin sees all pending (or filtered) requests.
// ---------------------------------------------------------------------------
const listAccessRequests = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const { status = "pending" } = req.query;

    const query: any = { workspace: workspaceId };
    if (status !== "all") query.status = status;

    const requests = await AccessRequest.find(query)
      .populate("requester", "name email profilePicture avatar")
      .populate("resolvedBy", "name email")
      .sort("-createdAt")
      .lean();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/:workspaceId/access-requests/:requestId/approve
// Owner/admin approves — adds user to workspace with requestedRole.
// ---------------------------------------------------------------------------
const approveAccessRequest = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId, requestId } = req.params;
    const resolverId = req.user!.id;

    const accessRequest = await AccessRequest.findOne({
      _id: requestId,
      workspace: workspaceId,
      status: "pending",
    }).populate("requester", "name email");

    if (!accessRequest) {
      return next(new AppError("Access request not found or already resolved", 404));
    }

    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
    if (!workspace) return next(new AppError("Workspace not found", 404));

    // Check not already a member (race condition guard)
    const alreadyMember = workspace.members.some(
      (m: any) => m.user.toString() === accessRequest.requester._id.toString()
    );

    if (!alreadyMember) {
      workspace.members.push({
        user: accessRequest.requester._id,
        role: accessRequest.requestedRole,
        status: "inactive",
      });
      await workspace.save();
    }

    // Mark request as approved
    accessRequest.status = "approved";
    accessRequest.resolvedBy = resolverId;
    accessRequest.resolvedAt = new Date();
    await accessRequest.save();

    // Notify the requester
    const resolver = await User.findById(resolverId).select("name");

    await notificationService.createNotification({
      recipientId: accessRequest.requester._id.toString(),
      type: "ACCESS_REQUEST_RESOLVED",
      title: "Access Request Approved",
      body: `${resolver.name} approved your request to join ${workspace.name} as ${accessRequest.requestedRole}`,
      data: {
        workspaceId,
        requestId: accessRequest._id.toString(),
        status: "approved",
        requestedRole: accessRequest.requestedRole,
        resourceType: "AccessRequest",
      },
    });

    res.status(200).json({
      success: true,
      message: `Request approved. ${accessRequest.requester.name} has been added as ${accessRequest.requestedRole}.`,
      data: {
        _id: accessRequest._id,
        status: "approved",
        requester: accessRequest.requester,
        requestedRole: accessRequest.requestedRole,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/:workspaceId/access-requests/:requestId/deny
// Owner/admin denies the request.
// ---------------------------------------------------------------------------
const denyAccessRequest = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId, requestId } = req.params;
    const resolverId = req.user!.id;

    const accessRequest = await AccessRequest.findOne({
      _id: requestId,
      workspace: workspaceId,
      status: "pending",
    }).populate("requester", "name email");

    if (!accessRequest) {
      return next(new AppError("Access request not found or already resolved", 404));
    }

    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
    if (!workspace) return next(new AppError("Workspace not found", 404));

    accessRequest.status = "denied";
    accessRequest.resolvedBy = resolverId;
    accessRequest.resolvedAt = new Date();
    await accessRequest.save();

    // Notify the requester
    const resolver = await User.findById(resolverId).select("name");

    await notificationService.createNotification({
      recipientId: accessRequest.requester._id.toString(),
      type: "ACCESS_REQUEST_RESOLVED",
      title: "Access Request Denied",
      body: `${resolver.name} denied your request to join ${workspace.name}`,
      data: {
        workspaceId,
        requestId: accessRequest._id.toString(),
        status: "denied",
        requestedRole: accessRequest.requestedRole,
        resourceType: "AccessRequest",
      },
    });

    res.status(200).json({
      success: true,
      message: "Access request denied.",
      data: {
        _id: accessRequest._id,
        status: "denied",
        requester: accessRequest.requester,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/workspaces/:workspaceId/access-requests/my
// Current user checks status of their own request for this workspace.
// ---------------------------------------------------------------------------
const getMyAccessRequest = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    const request = await AccessRequest.findOne({
      workspace: workspaceId,
      requester: userId,
    })
      .sort("-createdAt")
      .lean();

    res.status(200).json({
      success: true,
      data: request || null,
    });
  }
);

module.exports = {
  createAccessRequest,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  getMyAccessRequest,
};

export {};
