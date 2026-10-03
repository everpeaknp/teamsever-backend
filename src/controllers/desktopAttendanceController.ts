import { Request, Response, NextFunction } from "express";
import { normalizeDesktopAppId, normalizeDesktopPresenceStatus, validDesktopPresenceCapabilities, validDesktopActivityInterval, shouldFlagMissingPresenceHeartbeat, getDesktopPresenceGapBaseline } from "../services/desktopActivityValidation";
import { createDesktopCredential, hashDesktopCredential } from "../services/desktopDeviceToken";
import { canRecordDesktopPresence } from "../services/desktopPresenceAuthorization";
import { attendanceNetworkFingerprint } from "../services/attendanceNetworkFingerprint";
import { resolveAttendanceClientIp } from "../utils/attendanceClientIp";
import { createHash, randomInt } from "node:crypto";

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
  const devices = await TrustedAttendanceDevice.find({ user: req.user.id }).select("name platform activityMonitoringEnabled autoSyncMobileShifts lastSeenAt revokedAt createdAt").sort({ createdAt: -1 });
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
  const device = await TrustedAttendanceDevice.findOneAndUpdate({ _id: req.params.deviceId, user: req.user.id, revokedAt: null }, { $set: { activityMonitoringEnabled: enabled, activityMonitoringEnabledAt: enabled ? new Date() : null } }, { new: true });
  if (!device) return next(new AppError("Active device not found", 404));
  return res.json({ success: true, data: { id: device._id, activityMonitoringEnabled: device.activityMonitoringEnabled } });
});

const setAutoSyncMobileShifts = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") return next(new AppError("enabled must be a boolean", 400));
  const device = await TrustedAttendanceDevice.findOneAndUpdate(
    { _id: req.params.deviceId, user: req.user.id, revokedAt: null },
    { $set: { autoSyncMobileShifts: enabled } },
    { new: true },
  );
  if (!device) return next(new AppError("Active device not found", 404));
  return res.json({ success: true, data: { id: device._id, autoSyncMobileShifts: device.autoSyncMobileShifts } });
});

const getDeviceStatus = asyncHandler(async (req: any, res: Response) => {
  const entry = await TimeEntry.findOne({ user: req.user.id, isRunning: true, isDeleted: false })
    .select("workspace startTime clockInSource clockInDevice desktopPresenceDevice +presenceCompanionDevice +networkFingerprint +networkFingerprintExpiresAt +companionDismissedDevices")
    .sort({ startTime: -1 });
  const deviceId = String(req.desktopDevice._id);
  const clockedInOnThisDevice = !!entry && entry.clockInSource === "desktop" && String(entry.clockInDevice) === deviceId;
  let presenceTrackingActive = !!entry && !!req.desktopDevice.activityMonitoringEnabled && (clockedInOnThisDevice || String(entry.desktopPresenceDevice || "") === deviceId);
  let pendingMobileShift: { timeEntryId: string; workspaceId: string; startTime: string } | null = null;
  if (entry?.clockInSource === "mobile") {
    if (String(entry.presenceCompanionDevice || "") === deviceId && req.desktopDevice.activityMonitoringEnabled) {
      presenceTrackingActive = true;
    } else if (!entry.presenceCompanionDevice && req.desktopDevice.activityMonitoringEnabled) {
      const dismissed = (entry.companionDismissedDevices || []).some((id: any) => String(id) === deviceId);
      const fingerprintFresh = !!entry.networkFingerprintExpiresAt && new Date(entry.networkFingerprintExpiresAt).getTime() > Date.now();
      const ip = await resolveAttendanceClientIp(req.ip);
      const fingerprint = attendanceNetworkFingerprint(ip);
      if (!dismissed && fingerprintFresh && fingerprint && fingerprint === entry.networkFingerprint) {
        if (req.desktopDevice.autoSyncMobileShifts) {
          const linked = await TimeEntry.findOneAndUpdate(
            { _id: entry._id, user: req.user.id, isRunning: true, clockInSource: "mobile", presenceCompanionDevice: { $exists: false }, networkFingerprint: fingerprint },
            { $set: { presenceCompanionDevice: req.desktopDevice._id }, $unset: { networkFingerprint: 1, networkFingerprintExpiresAt: 1 } },
            { new: true },
          );
          presenceTrackingActive = !!linked;
        } else {
          pendingMobileShift = { timeEntryId: String(entry._id), workspaceId: String(entry.workspace), startTime: new Date(entry.startTime).toISOString() };
        }
      }
    }
  }
  return res.json({ success: true, data: {
    clockedIn: !!entry,
    hasActiveShift: !!entry,
    clockedInOnThisDevice,
    presenceTrackingActive,
    workspaceId: presenceTrackingActive ? entry?.workspace : null,
    timeEntryId: presenceTrackingActive ? entry?._id : null,
    startTime: presenceTrackingActive ? entry?.startTime : null,
    clockInSource: entry?.clockInSource || null,
    source: entry?.clockInSource || null,
    activityMonitoringEnabled: req.desktopDevice.activityMonitoringEnabled,
    pendingMobileShift,
  } });
});

const respondToMobileShift = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const action = req.body?.action;
  if (!["sync_once", "always", "not_now"].includes(action)) return next(new AppError("Invalid companion action", 400));
  if (!req.desktopDevice.activityMonitoringEnabled) return next(new AppError("Enable foreground app presence for this desktop before linking a mobile shift", 403));
  const entry = await TimeEntry.findOne({
    _id: req.params.timeEntryId,
    user: req.user.id,
    isRunning: true,
    isDeleted: false,
    clockInSource: "mobile",
    presenceCompanionDevice: { $exists: false },
  }).select("+networkFingerprint +networkFingerprintExpiresAt");
  if (!entry) return next(new AppError("Mobile shift is no longer available to sync", 409));
  if (action === "not_now") {
    await TimeEntry.updateOne({ _id: entry._id, isRunning: true }, { $addToSet: { companionDismissedDevices: req.desktopDevice._id } });
    return res.json({ success: true, data: { synced: false } });
  }
  const ip = await resolveAttendanceClientIp(req.ip);
  const fingerprint = attendanceNetworkFingerprint(ip);
  const fingerprintFresh = !!entry.networkFingerprintExpiresAt && new Date(entry.networkFingerprintExpiresAt).getTime() > Date.now();
  if (!fingerprintFresh || !fingerprint || fingerprint !== entry.networkFingerprint) {
    return next(new AppError("This mobile shift is not on the same network. Use the pairing code from the mobile app.", 409));
  }
  if (action === "always") {
    req.desktopDevice.autoSyncMobileShifts = true;
    await req.desktopDevice.save();
  }
  const linked = await TimeEntry.findOneAndUpdate(
    { _id: entry._id, user: req.user.id, isRunning: true, clockInSource: "mobile", presenceCompanionDevice: { $exists: false }, networkFingerprint: fingerprint },
    { $set: { presenceCompanionDevice: req.desktopDevice._id }, $unset: { networkFingerprint: 1, networkFingerprintExpiresAt: 1 } },
    { new: true },
  );
  if (!linked) return next(new AppError("Mobile shift was already paired with another desktop", 409));
  return res.json({ success: true, data: { synced: true, alwaysSync: action === "always" } });
});

const createMobilePairingCode = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const entry = await TimeEntry.findOneAndUpdate(
    { user: req.user.id, workspace: req.params.workspaceId, isRunning: true, isDeleted: false, clockInSource: "mobile", presenceCompanionDevice: { $exists: false } },
    { $set: { companionPairingCodeHash: createHash("sha256").update(code).digest("hex"), companionPairingExpiresAt: expiresAt } },
    { new: true },
  ).select("_id");
  if (!entry) return next(new AppError("Clock in from the mobile app before pairing a desktop", 409));
  return res.json({ success: true, data: { code, expiresAt } });
});

const pairMobileShiftWithCode = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  if (!req.desktopDevice.activityMonitoringEnabled) return next(new AppError("Enable foreground app presence for this desktop before linking a mobile shift", 403));
  const code = String(req.body?.code || "");
  if (!/^\d{6}$/.test(code)) return next(new AppError("Enter the 6-digit code shown in the mobile app", 400));
  const codeHash = createHash("sha256").update(code).digest("hex");
  const linked = await TimeEntry.findOneAndUpdate(
    { user: req.user.id, isRunning: true, isDeleted: false, clockInSource: "mobile", presenceCompanionDevice: { $exists: false }, companionPairingCodeHash: codeHash, companionPairingExpiresAt: { $gt: new Date() } },
    { $set: { presenceCompanionDevice: req.desktopDevice._id }, $unset: { companionPairingCodeHash: 1, companionPairingExpiresAt: 1, networkFingerprint: 1, networkFingerprintExpiresAt: 1 } },
    { new: true },
  ).select("workspace startTime");
  if (!linked) return next(new AppError("Pairing code is invalid or expired", 409));
  return res.json({ success: true, data: { synced: true, workspaceId: linked.workspace, startTime: linked.startTime } });
});

const attachPresenceToActiveShift = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  if (req.body?.consent !== true) return next(new AppError("Explicit consent is required to share desktop presence for this shift", 400));
  if (!req.desktopDevice.activityMonitoringEnabled) return next(new AppError("Enable desktop presence consent on this device first", 403));
  const entry = await TimeEntry.findOne({ user: req.user.id, isRunning: true, isDeleted: false });
  if (!entry) return next(new AppError("No active shift was found for this account", 409));
  const deviceId = String(req.desktopDevice._id);
  if (entry.clockInSource === "desktop" && String(entry.clockInDevice || "") === deviceId) {
    return res.json({ success: true, data: { workspaceId: entry.workspace, timeEntryId: entry._id, startTime: entry.startTime, presenceTrackingActive: true, clockedInOnThisDevice: true } });
  }
  if (entry.clockInSource === "desktop") return next(new AppError("This shift is already tied to another desktop for attendance and presence", 409));
  if (entry.desktopPresenceDevice && String(entry.desktopPresenceDevice) !== deviceId) return next(new AppError("Another paired desktop is already reporting presence for this shift", 409));
  entry.desktopPresenceDevice = req.desktopDevice._id;
  entry.desktopPresenceConsentedAt = new Date();
  await entry.save();
  return res.json({ success: true, data: { workspaceId: entry.workspace, timeEntryId: entry._id, startTime: entry.startTime, presenceTrackingActive: true, clockedInOnThisDevice: false } });
});

const recordAppPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const { workspaceId, timeEntryId, appId, startedAt, endedAt } = req.body || {};
  const rawStatus = req.body?.presenceStatus;
  const isLegacyHeartbeat = rawStatus === undefined && req.body?.foregroundAppSupported === undefined && req.body?.idleDetectionSupported === undefined;
  const presenceStatus = isLegacyHeartbeat ? "unavailable" : normalizeDesktopPresenceStatus(rawStatus);
  const safeAppId = appId === null || appId === undefined ? null : normalizeDesktopAppId(appId);
  const foregroundAppSupported = isLegacyHeartbeat ? !!safeAppId : req.body?.foregroundAppSupported;
  const idleDetectionSupported = isLegacyHeartbeat ? false : req.body?.idleDetectionSupported;
  if (!presenceStatus || (appId !== null && appId !== undefined && !safeAppId) || !mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(timeEntryId) || !validDesktopActivityInterval(startedAt, endedAt) || !validDesktopPresenceCapabilities(presenceStatus, foregroundAppSupported, idleDetectionSupported) || (safeAppId && !foregroundAppSupported)) return next(new AppError("Invalid desktop presence sample", 400));
  if (!req.desktopDevice.activityMonitoringEnabled) return next(new AppError("Desktop presence monitoring is disabled for this device", 403));
  const entry = await TimeEntry.findOne({ _id: timeEntryId, workspace: workspaceId, user: req.user.id, isRunning: true, isDeleted: false, $or: [{ clockInSource: "desktop", clockInDevice: req.desktopDevice._id }, { desktopPresenceDevice: req.desktopDevice._id }, { clockInSource: "mobile", presenceCompanionDevice: req.desktopDevice._id }] });
  if (!entry || !canRecordDesktopPresence({
    monitoringEnabled: req.desktopDevice.activityMonitoringEnabled,
    isRunning: !!entry.isRunning,
    entrySource: entry.clockInSource,
    entryUserId: String(entry.user),
    entryDeviceId: String(entry.clockInDevice),
    presenceDeviceId: String(entry.desktopPresenceDevice || ""),
    companionDeviceId: entry.presenceCompanionDevice ? String(entry.presenceCompanionDevice) : null,
    userId: String(req.user.id),
    deviceId: String(req.desktopDevice._id),
  })) return next(new AppError("No consented active desktop shift for this device", 409));
  const previousFilter: any = { timeEntry: timeEntryId, device: req.desktopDevice._id };
  if (req.desktopDevice.activityMonitoringEnabledAt) previousFilter.createdAt = { $gte: req.desktopDevice.activityMonitoringEnabledAt };
  const previous = await DesktopAppPresence.findOne(previousFilter).sort({ endedAt: -1 }).select("endedAt");
  if (previous && Date.parse(startedAt) - new Date(previous.endedAt).getTime() > 90_000) {
    await DesktopTrackingGap.updateOne({ timeEntry: timeEntryId, gapStartedAt: previous.endedAt }, { $setOnInsert: { user: req.user.id, workspace: workspaceId, device: req.desktopDevice._id, gapEndedAt: new Date(startedAt), reason: "presence_heartbeat_missing" } }, { upsert: true });
  }
  await DesktopAppPresence.create({ user: req.user.id, workspace: workspaceId, timeEntry: timeEntryId, device: req.desktopDevice._id, appId: safeAppId, presenceStatus, foregroundAppSupported, idleDetectionSupported, startedAt: new Date(startedAt), endedAt: new Date(endedAt) });
  return res.status(201).json({ success: true });
});

const getAppPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const { workspaceId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
  const workspace = await Workspace.findById(workspaceId).select("owner members");
  if (!workspace) return next(new AppError("Workspace not found", 404));
  const isOwner = String(workspace.owner) === String(req.user.id);
  const isActiveMember = (workspace.members || []).some((item: any) => String(item.user?._id || item.user) === String(req.user.id) && item.status !== "inactive");
  const hasOwnActiveDesktopShift = !isOwner && !isActiveMember && await TimeEntry.exists({
    workspace: workspaceId,
    user: req.user.id,
    isRunning: true,
    isDeleted: false,
    $or: [{ clockInSource: "desktop" }, { desktopPresenceDevice: { $exists: true, $ne: null } }, { clockInSource: "mobile", presenceCompanionDevice: { $exists: true, $ne: null } }],
  });
  if (!isOwner && !isActiveMember && !hasOwnActiveDesktopShift) return next(new AppError("Active workspace membership required", 403));
  const teamRequested = req.query.userId === "all";
  const targetUserId = req.query.userId && !teamRequested ? String(req.query.userId) : String(req.user.id);
  const canSeeTeam = isOwner || (await PermissionService.can(req.user.id, "MANAGE_ADDRESSES", { userId: req.user.id, workspaceId })) || (await PermissionService.can(req.user.id, "MANAGE_ATTENDANCE_LOCATIONS", { userId: req.user.id, workspaceId }));
  if ((targetUserId !== String(req.user.id) || teamRequested) && !canSeeTeam) return next(new AppError("You may only view your own desktop app presence", 403));
  if (req.query.userId && req.query.userId !== "all" && !mongoose.Types.ObjectId.isValid(targetUserId)) return next(new AppError("Invalid member ID", 400));
  if (req.query.userId && req.query.userId !== "all" && !isOwner && !(workspace.members || []).some((item: any) => String(item.user?._id || item.user) === targetUserId && item.status !== "inactive")) return next(new AppError("Active workspace member not found", 404));
  const filter: any = { workspace: workspaceId, ...(!teamRequested ? { user: targetUserId } : {}) };
  if (req.query.timeEntryId && !mongoose.Types.ObjectId.isValid(req.query.timeEntryId)) return next(new AppError("Invalid time entry ID", 400));
  if (req.query.timeEntryId) filter.timeEntry = req.query.timeEntryId;
  if (req.query.startDate || req.query.endDate) {
    if (!req.query.startDate || !req.query.endDate) return next(new AppError("Both start and end dates are required", 400));
    const range: any = {};
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const isValidDate = (value: unknown) => typeof value === "string" && datePattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (req.query.startDate && !isValidDate(String(req.query.startDate))) return next(new AppError("Invalid start date", 400));
    if (req.query.endDate && !isValidDate(String(req.query.endDate))) return next(new AppError("Invalid end date", 400));
    if (req.query.startDate) range.$gte = new Date(String(req.query.startDate));
    if (req.query.endDate) { const end = new Date(String(req.query.endDate)); end.setUTCHours(23, 59, 59, 999); range.$lte = end; }
    if (range.$gte && range.$lte && range.$gte > range.$lte) return next(new AppError("Start date must be on or before end date", 400));
    if (range.$gte && range.$lte && range.$lte.getTime() - range.$gte.getTime() > 90 * 24 * 60 * 60_000) return next(new AppError("Desktop presence reports are limited to 90 days at a time", 400));
    filter.startedAt = range;
  }
  const gapFilter: any = { ...filter };
  delete gapFilter.startedAt;
  if (filter.startedAt) gapFilter.gapStartedAt = filter.startedAt;
  const [events, savedGaps] = await Promise.all([
    DesktopAppPresence.find(filter).select("appId presenceStatus foregroundAppSupported idleDetectionSupported startedAt endedAt timeEntry user createdAt").populate("user", "name").sort({ startedAt: -1 }).limit(1000).lean(),
    DesktopTrackingGap.find(gapFilter).select("gapStartedAt gapEndedAt reason timeEntry user createdAt").populate("user", "name").sort({ gapStartedAt: -1 }).limit(1000).lean(),
  ]);
  const now = new Date();
  const reportIncludesNow = !filter.startedAt || ((!filter.startedAt.$gte || now >= filter.startedAt.$gte) && (!filter.startedAt.$lte || now <= filter.startedAt.$lte));
  const openGaps: any[] = [];
  if (reportIncludesNow) {
    const runningEntries = await TimeEntry.find({ workspace: workspaceId, ...(teamRequested ? {} : { user: targetUserId }), isRunning: true, isDeleted: false, $or: [{ clockInSource: "desktop" }, { desktopPresenceDevice: { $exists: true, $ne: null } }, { clockInSource: "mobile", presenceCompanionDevice: { $exists: true, $ne: null } }] }).select("user startTime clockInSource clockInDevice desktopPresenceDevice presenceCompanionDevice").populate("user", "name").lean();
    const deviceIds = runningEntries.map((entry: any) => entry.clockInSource === "mobile" ? entry.presenceCompanionDevice : entry.clockInSource === "desktop" ? entry.clockInDevice : entry.desktopPresenceDevice).filter(Boolean);
    const enabledDevices = await TrustedAttendanceDevice.find({ _id: { $in: deviceIds }, revokedAt: null, activityMonitoringEnabled: true }).select("_id activityMonitoringEnabledAt").lean();
    const allowedDeviceIds = new Set(enabledDevices.map((device: any) => String(device._id)));
    const enabledAtByDevice = new Map<string, number | null>(enabledDevices.map((device: any): [string, number | null] => [String(device._id), device.activityMonitoringEnabledAt ? new Date(device.activityMonitoringEnabledAt).getTime() : null]));
    const entryIds = runningEntries.map((entry: any) => entry._id);
    const latestEvents = await DesktopAppPresence.find({ workspace: workspaceId, timeEntry: { $in: entryIds } }).select("timeEntry device endedAt").sort({ endedAt: -1 }).lean();
    const latestByEntry = new Map<string, any>();
    for (const event of latestEvents) if (!latestByEntry.has(String(event.timeEntry))) latestByEntry.set(String(event.timeEntry), event);
    for (const entry of runningEntries) {
      const event = latestByEntry.get(String(entry._id));
      const deviceId = String(entry.clockInSource === "mobile" ? entry.presenceCompanionDevice || "" : entry.clockInSource === "desktop" ? entry.clockInDevice || "" : entry.desktopPresenceDevice || "");
      if (!allowedDeviceIds.has(deviceId) || (event && String(event.device) !== deviceId)) continue;
      const lastSeenAt = getDesktopPresenceGapBaseline(entry.startTime, enabledAtByDevice.get(deviceId), event?.endedAt);
      if (lastSeenAt === null) continue;
      if (shouldFlagMissingPresenceHeartbeat(lastSeenAt, now.getTime())) openGaps.push({ user: entry.user, timeEntry: entry._id, gapStartedAt: new Date(lastSeenAt), gapEndedAt: now, reason: "presence_heartbeat_missing", active: true });
    }
  }
  const gaps = [...savedGaps, ...openGaps].sort((a: any, b: any) => new Date(b.gapStartedAt).getTime() - new Date(a.gapStartedAt).getTime());
  return res.json({ success: true, data: { events, gaps } });
});

const canManageDesktopPresence = async (workspace: any, userId: string, workspaceId: string) => {
  if (String(workspace.owner) === userId) return true;
  const context = { userId, workspaceId };
  return (await PermissionService.can(userId, "MANAGE_ADDRESSES", context)) ||
    PermissionService.can(userId, "MANAGE_ATTENDANCE_LOCATIONS", context);
};

const loadDesktopPresenceWorkspace = async (workspaceId: string, userId: string, next: NextFunction) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    next(new AppError("Workspace not found", 400));
    return null;
  }
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace || workspace.isDeleted) {
    next(new AppError("Workspace not found", 404));
    return null;
  }
  const isOwner = String(workspace.owner) === userId;
  const member = (workspace.members || []).find((item: any) => String(item.user) === userId && item.status !== "inactive");
  if (!isOwner && !member) {
    next(new AppError("Active workspace membership required", 403));
    return null;
  }
  return workspace;
};

const getDesktopPresencePolicy = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const userId = String(req.user.id);
  const workspace = await loadDesktopPresenceWorkspace(workspaceId, userId, next);
  if (!workspace) return;
  const canManage = await canManageDesktopPresence(workspace, userId, workspaceId);
  const afkThresholdMinutes = workspace.desktopPresencePolicy?.afkThresholdMinutes ?? 5;
  return res.json({ success: true, data: { policy: { afkThresholdMinutes }, canManage } });
});

const updateDesktopPresencePolicy = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const userId = String(req.user.id);
  const { afkThresholdMinutes } = req.body || {};
  if (!Number.isInteger(afkThresholdMinutes) || afkThresholdMinutes < 1 || afkThresholdMinutes > 60) {
    return next(new AppError("AFK threshold must be a whole number from 1 to 60 minutes", 400));
  }
  const workspace = await loadDesktopPresenceWorkspace(workspaceId, userId, next);
  if (!workspace) return;
  if (!(await canManageDesktopPresence(workspace, userId, workspaceId))) {
    return next(new AppError("You do not have permission to manage desktop presence settings", 403));
  }
  workspace.desktopPresencePolicy = { afkThresholdMinutes };
  await workspace.save();
  return res.json({ success: true, data: { policy: { afkThresholdMinutes }, canManage: true } });
});
module.exports = { createDevice, listDevices, revokeDevice, setActivityConsent, setAutoSyncMobileShifts, createMobilePairingCode, pairMobileShiftWithCode, respondToMobileShift, getDeviceStatus, attachPresenceToActiveShift, recordAppPresence, getAppPresence, getDesktopPresencePolicy, updateDesktopPresencePolicy };
