import { Request, Response, NextFunction } from "express";
import { normalizeDesktopAppId, validDesktopActivityInterval, shouldFlagMissingPresenceHeartbeat } from "../services/desktopActivityValidation";
import { createDesktopCredential, hashDesktopCredential } from "../services/desktopDeviceToken";
import { canRecordDesktopPresence } from "../services/desktopPresenceAuthorization";

const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const TrustedAttendanceDevice = require("../models/TrustedAttendanceDevice");
const DesktopAppPresence = require("../models/DesktopAppPresence");
const DesktopTrackingGap = require("../models/DesktopTrackingGap");
const TimeEntry = require("../models/TimeEntry");
const PermissionService = require("../permissions/permission.service");
const Workspace = require("../models/Workspace");
const mongoose = require("mongoose");

const createDevice = asyncHandler(async (req: any, res: Response) => {
  const { name, platform } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) throw new AppError("Device name must be 1 to 80 characters", 400);
  if (!["windows", "linux"].includes(platform)) throw new AppError("Unsupported desktop platform", 400);
  const rawToken = createDesktopCredential();
  const device = await TrustedAttendanceDevice.create({ user: req.user.id, name: name.trim(), platform, tokenHash: hashDesktopCredential(rawToken) });
  return res.status(201).json({ success: true, data: { device: { id: device._id, name: device.name, platform, activityMonitoringEnabled: false }, credential: rawToken } });
});

const listDevices = asyncHandler(async (req: any, res: Response) => {
  const devices = await TrustedAttendanceDevice.find({ user: req.user.id }).select("name platform activityMonitoringEnabled lastSeenAt revokedAt createdAt").sort({ createdAt: -1 });
  return res.json({ success: true, data: devices });
});

const revokeDevice = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.deviceId)) return next(new AppError("Device not found", 404));
  const device = await TrustedAttendanceDevice.findOneAndUpdate({ _id: req.params.deviceId, user: req.user.id, revokedAt: null }, { $set: { revokedAt: new Date(), activityMonitoringEnabled: false } }, { new: true });
  if (!device) return next(new AppError("Active device not found", 404));
  return res.json({ success: true, message: "Desktop device revoked" });
});

const setActivityConsent = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") return next(new AppError("enabled must be a boolean", 400));
  if (!mongoose.Types.ObjectId.isValid(req.params.deviceId)) return next(new AppError("Device not found", 404));
  const device = await TrustedAttendanceDevice.findOneAndUpdate({ _id: req.params.deviceId, user: req.user.id, revokedAt: null }, { $set: { activityMonitoringEnabled: enabled } }, { new: true });
  if (!device) return next(new AppError("Active device not found", 404));
  return res.json({ success: true, data: { id: device._id, activityMonitoringEnabled: device.activityMonitoringEnabled } });
});

const getDeviceStatus = asyncHandler(async (req: any, res: Response) => {
  const entry = await TimeEntry.findOne({ user: req.user.id, isRunning: true, isDeleted: false }).select("workspace startTime clockInSource clockInDevice").sort({ startTime: -1 });
  const ownsActiveEntry = entry && entry.clockInSource === "desktop" && String(entry.clockInDevice) === String(req.desktopDevice._id);
  return res.json({ success: true, data: { clockedIn: !!ownsActiveEntry, workspaceId: ownsActiveEntry ? entry.workspace : null, timeEntryId: ownsActiveEntry ? entry._id : null, startTime: ownsActiveEntry ? entry.startTime : null, activityMonitoringEnabled: req.desktopDevice.activityMonitoringEnabled } });
});

const recordAppPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const { workspaceId, timeEntryId, appId, startedAt, endedAt } = req.body || {};
  const safeAppId = normalizeDesktopAppId(appId);
  if (!safeAppId || !mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(timeEntryId) || !validDesktopActivityInterval(startedAt, endedAt)) return next(new AppError("Invalid desktop activity interval", 400));
  if (!req.desktopDevice.activityMonitoringEnabled) return next(new AppError("Foreground app monitoring is disabled for this device", 403));
  const entry = await TimeEntry.findOne({ _id: timeEntryId, workspace: workspaceId, user: req.user.id, isRunning: true, isDeleted: false, clockInSource: "desktop", clockInDevice: req.desktopDevice._id });
  if (!entry || !canRecordDesktopPresence({
    monitoringEnabled: req.desktopDevice.activityMonitoringEnabled,
    isRunning: !!entry.isRunning,
    entrySource: entry.clockInSource,
    entryUserId: String(entry.user),
    entryDeviceId: String(entry.clockInDevice),
    userId: String(req.user.id),
    deviceId: String(req.desktopDevice._id),
  })) return next(new AppError("No consented active desktop shift for this device", 409));
  const previous = await DesktopAppPresence.findOne({ timeEntry: timeEntryId, device: req.desktopDevice._id }).sort({ endedAt: -1 }).select("endedAt");
  if (previous && Date.parse(startedAt) - new Date(previous.endedAt).getTime() > 90_000) {
    await DesktopTrackingGap.updateOne({ timeEntry: timeEntryId, gapStartedAt: previous.endedAt }, { $setOnInsert: { user: req.user.id, workspace: workspaceId, device: req.desktopDevice._id, gapEndedAt: new Date(startedAt), reason: "presence_heartbeat_missing" } }, { upsert: true });
  }
  await DesktopAppPresence.create({ user: req.user.id, workspace: workspaceId, timeEntry: timeEntryId, device: req.desktopDevice._id, appId: safeAppId, startedAt: new Date(startedAt), endedAt: new Date(endedAt) });
  return res.status(201).json({ success: true });
});

const getAppPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
  const workspace = await Workspace.findById(workspaceId).select("owner");
  if (!workspace) return next(new AppError("Workspace not found", 404));
  const teamRequested = req.query.userId === "all";
  const targetUserId = req.query.userId && !teamRequested ? String(req.query.userId) : String(req.user.id);
  const canSeeTeam = String(workspace.owner) === String(req.user.id) || await PermissionService.can(req.user.id, "MANAGE_ATTENDANCE_LOCATIONS", { userId: req.user.id, workspaceId });
  if ((targetUserId !== String(req.user.id) || teamRequested) && !canSeeTeam) return next(new AppError("You may only view your own desktop app presence", 403));
  if (req.query.userId && req.query.userId !== "all" && !mongoose.Types.ObjectId.isValid(targetUserId)) return next(new AppError("Invalid member ID", 400));
  const filter: any = { workspace: workspaceId, ...(!teamRequested ? { user: targetUserId } : {}) };
  if (req.query.timeEntryId && mongoose.Types.ObjectId.isValid(req.query.timeEntryId)) filter.timeEntry = req.query.timeEntryId;
  if (req.query.startDate || req.query.endDate) {
    const range: any = {};
    if (req.query.startDate && Number.isFinite(Date.parse(String(req.query.startDate)))) range.$gte = new Date(String(req.query.startDate));
    if (req.query.endDate && Number.isFinite(Date.parse(String(req.query.endDate)))) { const end = new Date(String(req.query.endDate)); end.setHours(23, 59, 59, 999); range.$lte = end; }
    if (Object.keys(range).length) { filter.startedAt = range; }
  }
  const gapFilter: any = { ...filter };
  delete gapFilter.startedAt;
  if (filter.startedAt) gapFilter.gapStartedAt = filter.startedAt;
  const [events, savedGaps] = await Promise.all([
    DesktopAppPresence.find(filter).select("appId startedAt endedAt timeEntry user createdAt").populate("user", "name").sort({ startedAt: -1 }).limit(1000).lean(),
    DesktopTrackingGap.find(gapFilter).select("gapStartedAt gapEndedAt reason timeEntry user createdAt").populate("user", "name").sort({ gapStartedAt: -1 }).limit(1000).lean(),
  ]);
  const now = new Date();
  const reportIncludesNow = !filter.startedAt || ((!filter.startedAt.$gte || now >= filter.startedAt.$gte) && (!filter.startedAt.$lte || now <= filter.startedAt.$lte));
  const openGaps: any[] = [];
  if (reportIncludesNow) {
    const runningEntries = await TimeEntry.find({ workspace: workspaceId, ...(teamRequested ? {} : { user: targetUserId }), isRunning: true, isDeleted: false, clockInSource: "desktop" }).select("user startTime clockInDevice").populate("user", "name").lean();
    const deviceIds = runningEntries.map((entry: any) => entry.clockInDevice).filter(Boolean);
    const enabledDevices = await TrustedAttendanceDevice.find({ _id: { $in: deviceIds }, revokedAt: null, activityMonitoringEnabled: true }).select("_id").lean();
    const allowedDeviceIds = new Set(enabledDevices.map((device: any) => String(device._id)));
    const entryIds = runningEntries.map((entry: any) => entry._id);
    const latestEvents = await DesktopAppPresence.find({ workspace: workspaceId, timeEntry: { $in: entryIds } }).select("timeEntry device endedAt").sort({ endedAt: -1 }).lean();
    const latestByEntry = new Map<string, any>();
    for (const event of latestEvents) if (!latestByEntry.has(String(event.timeEntry))) latestByEntry.set(String(event.timeEntry), event);
    for (const entry of runningEntries) {
      const event = latestByEntry.get(String(entry._id));
      const deviceId = String(entry.clockInDevice || "");
      if (!allowedDeviceIds.has(deviceId) || (event && String(event.device) !== deviceId)) continue;
      const lastSeenAt = event ? new Date(event.endedAt).getTime() : new Date(entry.startTime).getTime();
      if (shouldFlagMissingPresenceHeartbeat(lastSeenAt, now.getTime())) openGaps.push({ user: entry.user, timeEntry: entry._id, gapStartedAt: new Date(lastSeenAt), gapEndedAt: now, reason: "presence_heartbeat_missing", active: true });
    }
  }
  const gaps = [...savedGaps, ...openGaps].sort((a: any, b: any) => new Date(b.gapStartedAt).getTime() - new Date(a.gapStartedAt).getTime());
  return res.json({ success: true, data: { events, gaps } });
});

module.exports = { createDevice, listDevices, revokeDevice, setActivityConsent, getDeviceStatus, recordAppPresence, getAppPresence };
