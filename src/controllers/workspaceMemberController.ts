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
const { resolveAttendanceClientIp } = require("../utils/attendanceClientIp");
const { canClockOutFromClient, resolveAttendanceClockSource } = require("../services/desktopClockAuthorization");
const { attendanceNetworkFingerprint } = require("../services/attendanceNetworkFingerprint");

const toggleWorkspaceClock = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id: workspaceId } = req.params;
    const { status, locationFix } = req.body || {};
    const currentUserId = req.user!.id;
    const desktopDevice = (req as any).desktopDevice;
    const mobileClockRequest = (req as any).mobileClockRequest === true;
    const requestSource = resolveAttendanceClockSource({ mobileClockRequest, desktopDeviceId: desktopDevice?._id ? String(desktopDevice._id) : null });

    const validStatuses = ["active", "inactive"];
    if (!status || !validStatuses.includes(status)) {
      return next(new AppError("Invalid status", 400));
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
    const session = await mongoose.startSession();
    let result: any = null;
    try {
      await session.withTransaction(async () => {
        const workspaceQuery = Workspace.findOne({ _id: workspaceId, isDeleted: { $ne: true } });
        const workspace = await (workspaceQuery.select ? workspaceQuery.select("+members.privateRemoteAreas +members.temporaryRemoteApprovals").session(session) : workspaceQuery.session(session));
        if (!workspace) throw new AppError("Workspace not found", 404);
        if (String(workspace.owner) === currentUserId && !workspace.members.some((m: any) => String(m.user) === currentUserId)) {
          workspace.members.push({ user: currentUserId, role: "owner", status: "inactive", attendanceMode: "onsite" });
        }
        const member = AttendanceLocationService.assertActiveMember(workspace, currentUserId);
        if (status === "active") {
          const alreadyRunning = await TimeEntry.findOne({ user: currentUserId, workspace: workspaceId, isRunning: true, isDeleted: false }).session(session).select("_id");
          if (alreadyRunning) throw new AppError("You are already clocked in", 409);
          const observedClientIp = await resolveAttendanceClientIp(req.ip);
          const locationMatch = await AttendanceLocationService.validateClockInLocation(workspace, member, locationFix, new Date(), observedClientIp);
          const matchedArea = locationMatch && AttendanceLocationService.eligibleAreasForMember(workspace, member).find((area: any) => String(area._id) === String(locationMatch.areaId));
          const startTime = new Date();
          const [created] = await TimeEntry.create([{
            user: currentUserId, workspace: workspaceId, startTime, isRunning: true,
            clockInSource: requestSource,
            ...(desktopDevice ? { clockInDevice: desktopDevice._id } : {}),
            ...(requestSource === "mobile" ? { networkFingerprint: attendanceNetworkFingerprint(observedClientIp) || undefined, networkFingerprintExpiresAt: new Date(startTime.getTime() + 16 * 60 * 60 * 1000) } : {}),
            attendanceMode: locationMatch?.mode,
            clockInAreaId: locationMatch?.areaId,
            clockInVerificationMethod: locationMatch?.verificationMethod,
            ...(locationMatch && locationFix ? { clockInLocation: { latitude: locationFix.latitude, longitude: locationFix.longitude, accuracyMeters: locationFix.accuracyMeters, capturedAt: locationMatch.observedAt, areaName: matchedArea?.name } } : {}),
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
          const runningEntry = await TimeEntry.findOne({ user: currentUserId, workspace: workspaceId, isRunning: true, isDeleted: false }).select("+clockInLocation").session(session);
          if (runningEntry) {
            const entrySource = runningEntry.clockInSource || "web";
            if (!canClockOutFromClient(entrySource, runningEntry.clockInDevice ? String(runningEntry.clockInDevice) : null, requestSource, desktopDevice ? String(desktopDevice._id) : null)) throw new AppError("This shift must be clocked out from the same client and trusted device that clocked it in", 403);
            if (workspace.attendanceLocationPolicy?.enabled) {
              const locationResult = AttendanceLocationService.validateClockOutLocation(locationFix, runningEntry.clockInLocation, new Date(), workspace.attendanceLocationPolicy.maxAccuracyMeters || 100);
              const fixIsStructurallyValid = locationFix && Number.isFinite(locationFix.latitude) && Number.isFinite(locationFix.longitude) && typeof locationFix.accuracyMeters === "number" && Number.isFinite(Date.parse(locationFix.capturedAt));
              if (fixIsStructurallyValid) runningEntry.clockOutLocation = { latitude: locationFix.latitude, longitude: locationFix.longitude, accuracyMeters: locationFix.accuracyMeters, capturedAt: new Date(locationFix.capturedAt), distanceFromClockInMeters: locationResult.distanceMeters ?? undefined, withinRange: locationResult.withinRange };
              if (!locationResult.withinRange) runningEntry.locationReviewReason = locationResult.reason || "Clock-out location needs review";
            }
            runningEntry.endTime = new Date();
            runningEntry.isRunning = false;
            runningEntry.clockOutSource = requestSource;
            if (desktopDevice) runningEntry.clockOutDevice = desktopDevice._id;
            runningEntry.presenceCompanionDevice = undefined;
            runningEntry.networkFingerprint = undefined;
            runningEntry.networkFingerprintExpiresAt = undefined;
            runningEntry.companionPairingCodeHash = undefined;
            runningEntry.companionPairingExpiresAt = undefined;
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
    if (status === "inactive" && result.timeEntry?.locationReviewReason) {
      try {
        const existingFlag = await AttendanceLocationEvent.findOne({ timeEntry: result.timeEntry._id, activeReviewFlag: true }).select("_id");
        if (existingFlag) await AttendanceLocationEvent.updateOne({ _id: existingFlag._id }, { $set: { reason: result.timeEntry.locationReviewReason } });
        else await AttendanceLocationEvent.create({ workspace: workspaceId, user: currentUserId, timeEntry: result.timeEntry._id, mode: result.timeEntry.attendanceMode || "onsite", status: "unavailable", observedAt: new Date(), reason: result.timeEntry.locationReviewReason, activeReviewFlag: true });
      } catch (error) { console.error("[Clock] Could not persist clock-out location review event; the time entry retains its review reason", error); }
    }
    return res.status(200).json({ success: true, message: result.message, data: { status, timeEntry: result.timeEntry ? { _id: result.timeEntry._id, startTime: result.timeEntry.startTime, endTime: result.timeEntry.endTime, duration: result.timeEntry.duration, isRunning: result.timeEntry.isRunning, locationReviewReason: result.timeEntry.locationReviewReason } : null } });
  }
);

module.exports = { toggleWorkspaceClock };
export {};
