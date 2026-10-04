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
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  encodeRosterCursor,
  decodeRosterCursor,
  parseDesktopPresencePageSize,
  encodeHistoryCursor,
  decodeHistoryCursor,
  buildHistoryPagePipeline,
  buildHistorySummaryPipeline,
} = require("../services/desktopPresencePagination");

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

const getOpenPresenceGapsForMember = async (workspaceId: string, userId: string, now: Date) => {
  const entries = await TimeEntry.find({
    workspace: workspaceId,
    user: userId,
    isRunning: true,
    isDeleted: false,
    $or: [
      { clockInSource: "desktop", clockInDevice: { $exists: true, $ne: null } },
      { desktopPresenceDevice: { $exists: true, $ne: null } },
      { clockInSource: "mobile", presenceCompanionDevice: { $exists: true, $ne: null } },
    ],
  }).select("user startTime clockInSource clockInDevice desktopPresenceDevice presenceCompanionDevice").lean();
  if (!entries?.length) return [];
  const deviceForEntry = (entry: any) => String(entry.clockInSource === "mobile"
    ? entry.presenceCompanionDevice || ""
    : entry.clockInSource === "desktop"
      ? entry.clockInDevice || ""
      : entry.desktopPresenceDevice || "");
  const devices = await TrustedAttendanceDevice.find({
    _id: { $in: entries.map(deviceForEntry).filter(Boolean) },
    user: userId,
    revokedAt: null,
    activityMonitoringEnabled: true,
  }).select("_id activityMonitoringEnabledAt").lean();
  const enabledById = new Map<string, any>((devices || []).map((device: any): [string, any] => [String(device._id), device]));
  const eligibleEntries = entries.filter((entry: any) => enabledById.has(deviceForEntry(entry)));
  if (!eligibleEntries.length) return [];
  const latestEvents = await DesktopAppPresence.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), timeEntry: { $in: eligibleEntries.map((entry: any) => entry._id) } } },
    { $sort: { timeEntry: 1, endedAt: -1, _id: -1 } },
    { $group: { _id: "$timeEntry", report: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$report" } },
    { $project: { _id: 1, timeEntry: 1, device: 1, endedAt: 1 } },
  ]);
  const latestByEntry = new Map<string, any>((latestEvents || []).map((event: any): [string, any] => [String(event.timeEntry), event]));
  return eligibleEntries.flatMap((entry: any) => {
    const deviceId = deviceForEntry(entry);
    const device = enabledById.get(deviceId);
    const event = latestByEntry.get(String(entry._id));
    if (event && String(event.device) !== deviceId) return [];
    const lastSeenAt = getDesktopPresenceGapBaseline(entry.startTime, device.activityMonitoringEnabledAt, event?.endedAt);
    if (lastSeenAt === null || !shouldFlagMissingPresenceHeartbeat(lastSeenAt, now.getTime())) return [];
    return [{
      kind: "gap",
      id: `open:${String(entry._id)}`,
      reason: "presence_heartbeat_missing",
      active: true,
      startedAt: new Date(lastSeenAt),
      endedAt: now,
    }];
  });
};

const getAppPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const targetUserId = typeof req.query.userId === "string" ? req.query.userId : "";
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
  if (!targetUserId || targetUserId === "all" || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    return next(new AppError("A single valid member ID is required", 400));
  }
  const workspace = await Workspace.findById(workspaceId).select("owner members.user members.status");
  if (!workspace) return next(new AppError("Workspace not found", 404));
  const viewerId = String(req.user.id);
  const isOwner = String(workspace.owner) === viewerId;
  const viewerIsMember = (workspace.members || []).some((item: any) => String(item.user?._id || item.user) === viewerId && item.status !== "inactive");
  if (!isOwner && !viewerIsMember) return next(new AppError("Active workspace membership required", 403));
  const targetIsOwner = String(workspace.owner) === targetUserId;
  const targetIsMember = (workspace.members || []).some((item: any) => String(item.user?._id || item.user) === targetUserId && item.status !== "inactive");
  if (!targetIsOwner && !targetIsMember) return next(new AppError("Active workspace member not found", 404));
  if (!(await canManageDesktopPresence(workspace, viewerId, workspaceId))) {
    return next(new AppError("You do not have permission to view detailed desktop presence", 403));
  }

  const { startDate, endDate } = req.query;
  if (typeof startDate !== "string" || typeof endDate !== "string") return next(new AppError("Both start and end dates are required", 400));
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const isValidDate = (value: string) => datePattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!isValidDate(startDate)) return next(new AppError("Invalid start date", 400));
  if (!isValidDate(endDate)) return next(new AppError("Invalid end date", 400));
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (start > end) return next(new AppError("Start date must be on or before end date", 400));
  if (end.getTime() - start.getTime() > 90 * 24 * 60 * 60_000) return next(new AppError("Desktop presence reports are limited to 90 days at a time", 400));

  let pageSize: number;
  try {
    pageSize = parseDesktopPresencePageSize(req.query.pageSize);
  } catch (error: any) {
    return next(new AppError(error.message, 400));
  }
  const scope = { workspaceId, userId: targetUserId, startDate, endDate };
  let cursor: any = null;
  if (req.query.cursor !== undefined) {
    try {
      cursor = decodeHistoryCursor(req.query.cursor, scope);
    } catch {
      return next(new AppError("Invalid desktop presence cursor", 400));
    }
  }

  const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
  const userObjectId = new mongoose.Types.ObjectId(targetUserId);
  const now = new Date();
  const openGaps = end >= now && start <= now ? await getOpenPresenceGapsForMember(workspaceId, targetUserId, now) : [];
  const query = {
    ...scope,
    workspaceObjectId,
    userObjectId,
    start,
    end,
    pageSize,
    cursor,
    gapCollectionName: DesktopTrackingGap.collection.name,
  };
  const [pageRows, summaryRows, gapSummaryRows, target] = await Promise.all([
    DesktopAppPresence.aggregate(buildHistoryPagePipeline(query)),
    cursor ? Promise.resolve(null) : DesktopAppPresence.aggregate(buildHistorySummaryPipeline({ workspaceObjectId, userObjectId, start, end })),
    cursor ? Promise.resolve(null) : DesktopTrackingGap.aggregate([
      { $match: { workspace: workspaceObjectId, user: userObjectId, gapStartedAt: { $lte: end }, gapEndedAt: { $gte: start } } },
      { $set: {
        clippedStart: { $max: ["$gapStartedAt", start] },
        clippedEnd: { $min: ["$gapEndedAt", end] },
      } },
      { $project: { durationMs: { $subtract: ["$clippedEnd", "$clippedStart"] } } },
      { $group: { _id: null, gapMs: { $sum: "$durationMs" } } },
    ]),
    User.findById(targetUserId).select("name profilePicture").lean(),
  ]);
  const normalizedPageRows = (pageRows || []).map((row: any) => ({ ...row, startedAt: new Date(row.startedAt), endedAt: new Date(row.endedAt) }));
  const eligibleOpenGaps = openGaps
    .filter((gap: any) => gap.startedAt <= end && gap.endedAt >= start && (!cursor ||
      Math.min(gap.startedAt.getTime(), end.getTime()) < new Date(cursor.startedAt).getTime() ||
      (Math.min(gap.startedAt.getTime(), end.getTime()) === new Date(cursor.startedAt).getTime() && gap.id < cursor.id) ||
      (Math.min(gap.startedAt.getTime(), end.getTime()) === new Date(cursor.startedAt).getTime() && gap.id === cursor.id && cursor.kind === "app")))
    .map((gap: any) => ({ ...gap, startedAt: new Date(Math.max(gap.startedAt.getTime(), start.getTime())), endedAt: new Date(Math.min(gap.endedAt.getTime(), end.getTime())) }));
  const merged = [...normalizedPageRows, ...eligibleOpenGaps].sort((a: any, b: any) =>
    b.startedAt.getTime() - a.startedAt.getTime() || String(b.id).localeCompare(String(a.id)) || (a.kind === "app" ? -1 : 1));
  const hasMore = merged.length > pageSize;
  const items = merged.slice(0, pageSize);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeHistoryCursor({ ...scope, startedAt: last.startedAt.toISOString(), id: last.id, kind: last.kind }) : null;
  let summary = null;
  if (!cursor) {
    const appsById = new Map<string, { appId: string; durationMs: number; sessions: number }>();
    let activeMs = 0;
    let afkMs = 0;
    for (const row of summaryRows || []) {
      if (row._id?.presenceStatus === "active") activeMs += Number(row.durationMs || 0);
      if (row._id?.presenceStatus === "afk") afkMs += Number(row.durationMs || 0);
      if (!row._id?.appId) continue;
      const app = appsById.get(row._id.appId) || { appId: row._id.appId, durationMs: 0, sessions: 0 };
      app.durationMs += Number(row.durationMs || 0);
      app.sessions += Number(row.sessions || 0);
      appsById.set(row._id.appId, app);
    }
    const savedGapMs = Number(gapSummaryRows?.[0]?.gapMs || 0);
    const openGapMs = openGaps.reduce((total: number, gap: any) => total + Math.max(0, Math.min(gap.endedAt.getTime(), end.getTime()) - Math.max(gap.startedAt.getTime(), start.getTime())), 0);
    summary = { apps: [...appsById.values()].sort((a, b) => b.durationMs - a.durationMs), activeMs, afkMs, gapMs: savedGapMs + openGapMs };
  }
  return res.json({
    success: true,
    data: {
      member: { userId: targetUserId, displayName: target?.name || "Workspace member", avatar: target?.profilePicture || null },
      summary,
      items: items.map((item: any) => ({ ...item, startedAt: item.startedAt.toISOString(), endedAt: item.endedAt.toISOString() })),
      pagination: { nextCursor, hasMore, pageSize },
    },
  });
});
const canManageDesktopPresence = async (workspace: any, userId: string, workspaceId: string) => {
  if (String(workspace.owner) === userId) return true;
  const context = { userId, workspaceId };
  return (await PermissionService.can(userId, "MANAGE_ADDRESSES", context)) ||
    (await PermissionService.can(userId, "MANAGE_ATTENDANCE_LOCATIONS", context));
};

const normalizeRosterName = (name: string) => name.normalize("NFKC").trim().toLocaleLowerCase("en");

const getWorkspaceCurrentPresence = asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) return next(new AppError("Workspace not found", 404));
  const workspace = await Workspace.findById(workspaceId).select("owner members.user members.status");
  if (!workspace) return next(new AppError("Workspace not found", 404));

  const viewerId = String(req.user.id);
  const isOwner = String(workspace.owner) === viewerId;
  const activeMembers = (workspace.members || []).filter((member: any) => member.status !== "inactive");
  const isMember = activeMembers.some((member: any) => String(member.user?._id || member.user) === viewerId);
  if (!isOwner && !isMember) return next(new AppError("Active workspace membership required", 403));

  let pageSize: number;
  try {
    pageSize = parseDesktopPresencePageSize(req.query.pageSize);
  } catch (error: any) {
    return next(new AppError(error.message, 400));
  }
  let cursor: { name: string; userId: string } | null = null;
  if (req.query.cursor !== undefined) {
    try {
      cursor = decodeRosterCursor(req.query.cursor);
      if (!mongoose.Types.ObjectId.isValid(cursor.userId)) throw new Error("Invalid desktop presence cursor");
    } catch {
      return next(new AppError("Invalid desktop presence cursor", 400));
    }
  }

  const memberIds = new Set<string>(activeMembers.map((member: any) => String(member.user?._id || member.user)));
  memberIds.add(String(workspace.owner));
  const ids: string[] = [...memberIds].filter((id: string) => mongoose.Types.ObjectId.isValid(id));
  const users = await User.find({ _id: { $in: ids }, deletedAt: null }).select("name profilePicture").lean();
  const usersById = new Map<string, any>((users || []).map((user: any): [string, any] => [String(user._id), user]));
  const ordered = ids.flatMap((userId) => {
    const user = usersById.get(userId);
    if (!user) return [];
    return [{ userId, user, sortName: normalizeRosterName(String(user.name || "")) }];
  }).sort((left, right) => left.sortName.localeCompare(right.sortName, "en") || left.userId.localeCompare(right.userId));
  const afterCursor = cursor ? ordered.filter((member) => member.sortName > cursor!.name || (member.sortName === cursor!.name && member.userId > cursor!.userId)) : ordered;
  const page = afterCursor.slice(0, pageSize + 1);
  const hasMore = page.length > pageSize;
  if (hasMore) page.pop();
  const pageIds = page.map((member) => new mongoose.Types.ObjectId(member.userId));

  const [runningEntries, canViewHistory] = await Promise.all([
    pageIds.length ? TimeEntry.find({
      workspace: workspaceId,
      user: { $in: pageIds },
      isRunning: true,
      isDeleted: false,
      $or: [
        { clockInSource: "desktop", clockInDevice: { $exists: true, $ne: null } },
        { desktopPresenceDevice: { $exists: true, $ne: null } },
        { clockInSource: "mobile", presenceCompanionDevice: { $exists: true, $ne: null } },
      ],
    }).select("user startTime clockInSource clockInDevice desktopPresenceDevice presenceCompanionDevice").lean() : Promise.resolve([]),
    canManageDesktopPresence(workspace, viewerId, workspaceId),
  ]);

  const expectedDeviceByEntry = new Map<string, { userId: string; deviceId: string }>();
  const deviceIds = new Set<string>();
  for (const entry of runningEntries || []) {
    const userId = String(entry.user?._id || entry.user);
    const deviceId = String(entry.clockInSource === "mobile"
      ? entry.presenceCompanionDevice || ""
      : entry.clockInSource === "desktop"
        ? entry.clockInDevice || ""
        : entry.desktopPresenceDevice || "");
    if (!deviceId || !page.some((member) => member.userId === userId)) continue;
    expectedDeviceByEntry.set(String(entry._id), { userId, deviceId });
    deviceIds.add(deviceId);
  }
  const eligibleDevices = deviceIds.size ? await TrustedAttendanceDevice.find({
    _id: { $in: [...deviceIds] },
    user: { $in: pageIds },
    revokedAt: null,
    activityMonitoringEnabled: true,
  }).select("_id user activityMonitoringEnabledAt").lean() : [];
  const eligibleById = new Map<string, any>((eligibleDevices || []).map((device: any): [string, any] => [String(device._id), device]));
  const enabledEntries = [...expectedDeviceByEntry.entries()].filter(([, expected]) => eligibleById.has(expected.deviceId));
  const latestReports = enabledEntries.length ? await DesktopAppPresence.aggregate([
    { $match: { workspace: new mongoose.Types.ObjectId(workspaceId), timeEntry: { $in: enabledEntries.map(([entryId]) => new mongoose.Types.ObjectId(entryId)) } } },
    { $sort: { timeEntry: 1, endedAt: -1, _id: -1 } },
    { $group: { _id: "$timeEntry", report: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$report" } },
    { $project: { timeEntry: 1, device: 1, appId: 1, presenceStatus: 1, endedAt: 1 } },
  ]) : [];
  const now = Date.now();
  const presenceByUser = new Map<string, any>();
  for (const report of latestReports || []) {
    const expected = expectedDeviceByEntry.get(String(report.timeEntry));
    const device = expected && eligibleById.get(expected.deviceId);
    if (!expected || !device || String(report.device) !== expected.deviceId || String(device.user) !== expected.userId) continue;
    const reportedAt = new Date(report.endedAt).getTime();
    const enabledAt = device.activityMonitoringEnabledAt ? new Date(device.activityMonitoringEnabledAt).getTime() : null;
    if (!Number.isFinite(reportedAt) || now - reportedAt > 90_000 || reportedAt > now + 30_000 || (enabledAt !== null && reportedAt < enabledAt)) continue;
    if (report.presenceStatus !== "active" && report.presenceStatus !== "afk") continue;
    const existing = presenceByUser.get(expected.userId);
    if (!existing || reportedAt > new Date(existing.reportedAt).getTime()) {
      presenceByUser.set(expected.userId, {
        appId: report.appId || null,
        presenceStatus: report.presenceStatus,
        reportedAt: new Date(reportedAt).toISOString(),
      });
    }
  }

  const members = page.map(({ userId, user }) => ({
    userId,
    displayName: user.name,
    avatar: user.profilePicture || null,
    presence: presenceByUser.get(userId) || null,
  }));
  const last = page[page.length - 1];
  return res.json({
    success: true,
    data: {
      members,
      pagination: { nextCursor: hasMore && last ? encodeRosterCursor(last.sortName, last.userId) : null, hasMore, pageSize },
      permissions: { canViewHistory },
    },
  });
});

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
module.exports = { createDevice, listDevices, revokeDevice, setActivityConsent, setAutoSyncMobileShifts, createMobilePairingCode, pairMobileShiftWithCode, respondToMobileShift, getDeviceStatus, attachPresenceToActiveShift, recordAppPresence, getAppPresence, getWorkspaceCurrentPresence, getDesktopPresencePolicy, updateDesktopPresencePolicy };
