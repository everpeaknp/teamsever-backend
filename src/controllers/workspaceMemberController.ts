import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

const asyncHandler = require("../utils/asyncHandler");
const Workspace = require("../models/Workspace");
const TimeEntry = require("../models/TimeEntry");
const AppError = require("../utils/AppError");
const analyticsV2CacheService = require("../services/analyticsV2CacheService");
const mongoose = require("mongoose");
const AttendanceLocationService = require("../services/attendanceLocationService");
const AttendanceLocationEvent = require("../models/AttendanceLocationEvent");

const toggleWorkspaceClock = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: workspaceId } = req.params;
    const { status, locationFix } = req.body || {};
    const currentUserId = req.user!.id;

    const validStatuses = ["active", "inactive"];
    if (!status || !validStatuses.includes(status)) {
      return next(new AppError("Invalid status", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
    const session = await mongoose.startSession();
    let result: any = null;
    try {
      await session.withTransaction(async () => {
        const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: { $ne: true } }).session(session);
        if (!workspace) throw new AppError("Workspace not found", 404);
        if (String(workspace.owner) === currentUserId && !workspace.members.some((m: any) => String(m.user) === currentUserId)) {
          workspace.members.push({ user: currentUserId, role: "owner", status: "inactive", attendanceMode: "onsite" });
        }
        const member = AttendanceLocationService.assertActiveMember(workspace, currentUserId);
        if (status === "active") {
          const alreadyRunning = await TimeEntry.findOne({ user: currentUserId, workspace: workspaceId, isRunning: true, isDeleted: false }).session(session).select("_id");
          if (alreadyRunning) throw new AppError("You are already clocked in", 409);
          const locationMatch = await AttendanceLocationService.validateClockInLocation(workspace, member, locationFix);
          const startTime = new Date();
          const [created] = await TimeEntry.create([{
            user: currentUserId, workspace: workspaceId, startTime, isRunning: true,
            attendanceMode: locationMatch?.mode,
            clockInAreaId: locationMatch?.areaId,
            description: "Workspace clock in"
          }], { session });
          if (locationMatch) await AttendanceLocationEvent.create([{
            workspace: workspaceId, user: currentUserId, timeEntry: created._id,
            areaId: locationMatch.areaId, mode: locationMatch.mode, status: "inside",
            observedAt: locationMatch.observedAt, receivedAt: startTime,
            accuracyMeters: locationMatch.accuracyMeters, distanceMeters: locationMatch.distanceMeters,
            activeReviewFlag: false
          }], { session });
          member.status = "active";
          workspace.markModified("members");
          await workspace.save({ session });
          result = { status, message: "Clocked in", timeEntry: created };
        } else {
          const runningEntry = await TimeEntry.findOne({ user: currentUserId, workspace: workspaceId, isRunning: true, isDeleted: false }).session(session);
          if (runningEntry) {
            runningEntry.endTime = new Date();
            runningEntry.isRunning = false;
            await runningEntry.save({ session });
          }
          member.status = "inactive";
          workspace.markModified("members");
          await workspace.save({ session });
          result = { status, message: "Clocked out", timeEntry: runningEntry };
        }
      });
    } finally {
      await session.endSession();
    }
    await analyticsV2CacheService.invalidateWorkspace(workspaceId);
    return res.status(200).json({ success: true, message: result.message, data: { status, timeEntry: result.timeEntry ? { _id: result.timeEntry._id, startTime: result.timeEntry.startTime, endTime: result.timeEntry.endTime, duration: result.timeEntry.duration, isRunning: result.timeEntry.isRunning } : null } });
  }
);

module.exports = { toggleWorkspaceClock };
export {};
