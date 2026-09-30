const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const AppError = require("../utils/AppError");
const net = require("net");

const defaults = { enabled: false, maxAccuracyMeters: 100, checkIntervalSeconds: 60, staleAfterSeconds: 120, areas: [] as any[] };

export function assertActiveMember(workspace: any, userId: string) {
  const member = workspace.members.find((item: any) => String(item.user) === String(userId));
  // Workspace member status is the clock-in/out state, not membership activity.
  if (String(workspace.owner) !== String(userId) && !member) {
    throw new AppError("Active workspace membership required", 403);
  }
  return member || { user: workspace.owner, role: "owner", status: "active", attendanceMode: "onsite", assignedRemoteLocationIds: [] };
}

export function validateCoordinate(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (n: number) => n * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude), lat2 = toRad(b.latitude);
  const raw = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const h = Math.min(1, Math.max(0, raw));
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return net.isIP(ip) ? ip : null;
}

export function validateClockOutLocation(fix: any, clockInPoint: any, now = new Date(), maxAccuracyMeters = 100) {
  if (!fix || !validateCoordinate(fix.latitude, -90, 90) || !validateCoordinate(fix.longitude, -180, 180) || typeof fix.accuracyMeters !== "number" || !Number.isFinite(fix.accuracyMeters) || fix.accuracyMeters < 0 || typeof fix.capturedAt !== "string" || !Number.isFinite(Date.parse(fix.capturedAt))) {
    return { withinRange: false, distanceMeters: null, reason: "Clock-out location unavailable" };
  }
  const captured = Date.parse(fix.capturedAt);
  if (now.getTime() - captured > 120000 || captured - now.getTime() > 15000) return { withinRange: false, distanceMeters: null, reason: "Clock-out location is stale" };
  if (!clockInPoint || !validateCoordinate(clockInPoint.latitude, -90, 90) || !validateCoordinate(clockInPoint.longitude, -180, 180)) return { withinRange: false, distanceMeters: null, reason: "Clock-in location was not recorded" };
  const measuredDistance = distanceMeters(fix, clockInPoint);
  const distance = Math.round(measuredDistance);
  if (fix.accuracyMeters > maxAccuracyMeters) return { withinRange: false, distanceMeters: distance, reason: "Clock-out location accuracy is too low" };
  return { withinRange: measuredDistance <= 60, distanceMeters: distance, reason: measuredDistance <= 60 ? null : "Clock-out is more than 60 m from clock-in location" };
}

export function matchAttendanceArea(fix: any, areas: any[], policy: any, now = new Date()) {
  if (!fix || !validateCoordinate(fix.latitude, -90, 90) || !validateCoordinate(fix.longitude, -180, 180) || typeof fix.accuracyMeters !== "number" || !Number.isFinite(fix.accuracyMeters) || fix.accuracyMeters < 0 || typeof fix.capturedAt !== "string" || !fix.capturedAt.trim() || !Number.isFinite(Date.parse(fix.capturedAt))) {
    throw new AppError("A valid location reading is required", 400);
  }
  const capturedAt = new Date(fix.capturedAt).getTime();
  if (now.getTime() - capturedAt > 120000 || capturedAt - now.getTime() > 15000) throw new AppError("Location reading is stale", 400);
  if (fix.accuracyMeters > policy.maxAccuracyMeters) throw new AppError("Location accuracy is too low", 400);
  const matches = areas.map((area: any) => ({ area, distance: distanceMeters(fix, area) })).filter(({ area, distance }: any) => distance <= area.radiusMeters).sort((a: any, b: any) => a.distance - b.distance);
  const nearest = matches[0];
  if (!nearest) throw new AppError("You are outside your allowed attendance area", 403);
  return { areaId: nearest.area._id, distanceMeters: Math.round(nearest.distance), accuracyMeters: fix.accuracyMeters };
}

export async function loadWorkspace(workspaceId: string) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) throw new AppError("Workspace not found", 404);
  const query = Workspace.findOne({ _id: workspaceId, isDeleted: { $ne: true } });
  const workspace = await (query?.select ? query.select("+members.privateRemoteAreas +members.temporaryRemoteApprovals") : query);
  if (!workspace) throw new AppError("Workspace not found", 404);
  if (!workspace.attendanceLocationPolicy) workspace.attendanceLocationPolicy = defaults;
  return workspace;
}

export async function updateLocationPolicy(workspaceId: string, actorId: string, input: any) {
  const workspace = await loadWorkspace(workspaceId);
  assertActiveMember(workspace, actorId);
  const current = workspace.attendanceLocationPolicy?.toObject?.() || workspace.attendanceLocationPolicy || defaults;
  if (!input || typeof input !== "object" || !Array.isArray(input.areas)) throw new AppError("Invalid location policy", 400);
  if (input.areas.length > 100) throw new AppError("Maximum 100 areas allowed", 400);
  const areas = input.areas.map((area: any) => {
    if (!area || typeof area.name !== "string" || !area.name.trim() || area.name.trim().length > 80 || area.kind !== "office" || !validateCoordinate(area.latitude, -90, 90) || !validateCoordinate(area.longitude, -180, 180) || typeof area.isActive !== "boolean") throw new AppError("Only the shared office belongs in workspace location settings; remote areas are private to members", 400);
    return { _id: area._id && mongoose.Types.ObjectId.isValid(area._id) ? area._id : new mongoose.Types.ObjectId(), name: area.name.trim(), kind: "office", latitude: area.latitude, longitude: area.longitude, radiusMeters: 60, isActive: area.isActive };
  });
  if (areas.filter((area: any) => area.kind === "office").length > 1) {
    throw new AppError("Only one office location is allowed", 400);
  }
  const areaIds = areas.map((area: any) => String(area._id));
  if (new Set(areaIds).size !== areaIds.length) throw new AppError("Attendance area IDs must be unique", 400);
  const maxAccuracyMeters = input.maxAccuracyMeters ?? current.maxAccuracyMeters ?? 100;
  if (!Number.isFinite(maxAccuracyMeters) || maxAccuracyMeters < 1 || maxAccuracyMeters > 1000) throw new AppError("Maximum accuracy must be between 1 and 1000 meters", 400);
  const enabled = input.enabled === true;
  if (enabled) {
    if (!areas.some((area: any) => area.kind === "office" && area.isActive)) throw new AppError("Add an active office area before enabling enforcement", 400);
    for (const member of workspace.members) {
      if (member.attendanceMode === "remote") {
        if (!(member.privateRemoteAreas || []).some((area: any) => area.isActive)) throw new AppError("Every remote member must have an active private remote area", 400);
      }
    }
  }
  workspace.attendanceLocationPolicy = { enabled, maxAccuracyMeters, checkIntervalSeconds: 60, staleAfterSeconds: 120, areas } as any;
  await workspace.save();
  await WorkspaceActivity.createActivity({ workspace: workspaceId, user: actorId, type: "workspace_updated", description: "Updated attendance location policy", metadata: { action: "attendance_location_policy_updated", enabled, areaIds: areas.map((area: any) => String(area._id)) } });
  return workspace;
}

export async function assignMemberAttendanceLocations(workspaceId: string, actorId: string, memberId: string, input: any) {
  const workspace = await loadWorkspace(workspaceId);
  assertActiveMember(workspace, actorId);
  if (!mongoose.Types.ObjectId.isValid(memberId)) throw new AppError("Workspace member not found", 404);
  let member = workspace.members.find((item: any) => String(item.user) === memberId);
  if (!member && String(workspace.owner) === memberId) {
    workspace.members.push({ user: workspace.owner, role: "owner", status: "inactive", attendanceMode: "onsite", assignedRemoteLocationIds: [] });
    member = workspace.members[workspace.members.length - 1];
  }
  if (!member) throw new AppError("Workspace member not found", 404);
  if (!input || !["onsite", "remote"].includes(input.attendanceMode) || !Array.isArray(input.remoteAreaIds)) throw new AppError("Invalid attendance assignment", 400);
  const ids = [...new Set(input.remoteAreaIds.map(String))];
  if (ids.some((id: string) => !mongoose.Types.ObjectId.isValid(id))) throw new AppError("Invalid remote area assignment", 400);
  if (ids.length) throw new AppError("Remote places are private to each member; update the member's own remote areas instead", 400);
  if (input.attendanceMode === "remote" && workspace.attendanceLocationPolicy?.enabled && !(member.privateRemoteAreas || []).some((area: any) => area.isActive)) throw new AppError("Add at least one private remote place before setting this member to Remote", 400);
  member.attendanceMode = input.attendanceMode;
  member.assignedRemoteLocationIds = [] as any;
  workspace.markModified("members");
  await workspace.save();
  await WorkspaceActivity.createActivity({ workspace: workspaceId, user: actorId, targetUser: memberId, type: "workspace_updated", description: "Updated member attendance location assignment", metadata: { action: "attendance_location_member_assigned", targetMemberId: memberId, attendanceMode: input.attendanceMode, areaIds: ids } });
  return member;
}

export async function updateMemberRemoteAreas(workspaceId: string, actorId: string, memberId: string, input: any) {
  const workspace = await loadWorkspace(workspaceId);
  assertActiveMember(workspace, actorId);
  if (!mongoose.Types.ObjectId.isValid(memberId)) throw new AppError("Workspace member not found", 404);
  let member = workspace.members.find((item: any) => String(item.user) === memberId);
  if (!member && String(workspace.owner) === memberId) {
    workspace.members.push({ user: workspace.owner, role: "owner", status: "active", attendanceMode: "onsite", privateRemoteAreas: [] });
    member = workspace.members[workspace.members.length - 1];
  }
  if (!member) throw new AppError("Workspace member not found", 404);
  if (!input || !Array.isArray(input.areas) || input.areas.length > 30) throw new AppError("Invalid private remote areas", 400);
  const areas = input.areas.map((area: any) => {
    const networkIp = area?.networkIp == null || area.networkIp === "" ? undefined : normalizeIp(area.networkIp);
    if (!area || typeof area.name !== "string" || !area.name.trim() || area.name.trim().length > 80 || !validateCoordinate(area.latitude, -90, 90) || !validateCoordinate(area.longitude, -180, 180) || !Number.isFinite(area.radiusMeters) || area.radiusMeters < 25 || area.radiusMeters > 50000 || typeof area.isActive !== "boolean" || (area.networkIp && !networkIp)) throw new AppError("Invalid private remote area or public IP address", 400);
    return { _id: area._id && mongoose.Types.ObjectId.isValid(area._id) ? area._id : new mongoose.Types.ObjectId(), name: area.name.trim(), latitude: area.latitude, longitude: area.longitude, radiusMeters: area.radiusMeters, isActive: area.isActive, ...(networkIp ? { networkIp } : {}) };
  });
  const ids = areas.map((area: any) => String(area._id));
  if (new Set(ids).size !== ids.length) throw new AppError("Remote area IDs must be unique", 400);
  member.privateRemoteAreas = areas;
  workspace.markModified("members");
  await workspace.save();
  await WorkspaceActivity.createActivity({ workspace: workspaceId, user: actorId, targetUser: memberId, type: "workspace_updated", description: "Updated member private remote areas", metadata: { action: "member_private_remote_areas_updated", targetMemberId: memberId, areaIds: ids } });
  return member;
}

export function eligibleAreasForMember(workspace: any, member: any, at = new Date()) {
  const areas = workspace.attendanceLocationPolicy?.areas || [];
  if (member.attendanceMode === "remote") {
    const own = (member.privateRemoteAreas || []).filter((area: any) => area.isActive).map((area: any) => ({ ...(area.toObject?.() ?? area), kind: "remote" }));
    return own;
  }
  const officeAreas = areas.filter((area: any) => area.kind === "office" && area.isActive).map((area: any) => ({ ...(area.toObject?.() ?? area), radiusMeters: 60 }));
  const today = at.toISOString().slice(0, 10);
  const approvedIds = new Set((member.temporaryRemoteApprovals || []).filter((approval: any) => today >= new Date(approval.startDate).toISOString().slice(0, 10) && today <= new Date(approval.endDate).toISOString().slice(0, 10)).map((approval: any) => String(approval.areaId)));
  const allowedPrivate = (member.privateRemoteAreas || []).filter((area: any) => area.isActive && approvedIds.has(String(area._id))).map((area: any) => ({ ...(area.toObject?.() ?? area), kind: "remote" }));
  return [...officeAreas, ...allowedPrivate];
}

export async function validateClockInLocation(workspace: any, member: any, fix: any, now = new Date(), clientIp?: string) {
  const policy = workspace.attendanceLocationPolicy || defaults;
  if (!policy.enabled) return null;
  const areas = eligibleAreasForMember(workspace, member);
  if (areas.length === 0) throw new AppError("No active attendance area is assigned to you", 403);
  let match: any;
  let verificationMethod: "gps" | "network_confirmed" = "gps";
  try {
    match = matchAttendanceArea(fix, areas, policy, now);
  } catch (error: any) {
    // Network confirmation is only a fallback for a fresh, structurally valid,
    // low-accuracy reading whose uncertainty circle still overlaps this member's
    // private remote geofence. A matching IP alone must never authorize clock-in.
    const observedIp = normalizeIp(clientIp);
    const capturedAt = typeof fix?.capturedAt === "string" ? Date.parse(fix.capturedAt) : NaN;
    const validFix = validateCoordinate(fix?.latitude, -90, 90) && validateCoordinate(fix?.longitude, -180, 180) && Number.isFinite(fix?.accuracyMeters) && fix.accuracyMeters >= 0 && Number.isFinite(capturedAt) && now.getTime() - capturedAt <= 120000 && capturedAt - now.getTime() <= 15000;
    const maxFallbackAccuracyMeters = 250;
    const remoteAreas = areas.filter((area: any) => area.kind === "remote" && (member.privateRemoteAreas || []).some((privateArea: any) => String(privateArea._id) === String(area._id)));
    if (!validFix || fix.accuracyMeters <= policy.maxAccuracyMeters || remoteAreas.length === 0 || !remoteAreas.some((area: any) => normalizeIp(area.networkIp))) throw error;
    if (!observedIp) throw new AppError("GPS accuracy is too low, and the server could not verify this connection's IP. Check the backend trusted-proxy configuration.", 400);
    const matchingAreas = remoteAreas.filter((area: any) => normalizeIp(area.networkIp) === observedIp);
    if (!matchingAreas.length) throw new AppError("GPS accuracy is too low, and the IP seen by the server does not match this member's registered remote-place IP. Check the saved IP and backend trusted-proxy configuration.", 400);
    if (fix.accuracyMeters > maxFallbackAccuracyMeters) throw new AppError("GPS accuracy is too low for the network fallback. The uncertainty must be 250 m or better.", 400);
    const candidate = matchingAreas.map((area: any) => ({ area, distance: distanceMeters(fix, area) })).filter(({ area, distance }: any) => distance <= area.radiusMeters + fix.accuracyMeters).sort((a: any, b: any) => a.distance - b.distance)[0];
    if (!candidate) throw new AppError("The registered IP matched, but the GPS uncertainty circle does not overlap this remote place. Clock-in was stopped.", 403);
    match = { areaId: candidate.area._id, distanceMeters: Math.round(candidate.distance), accuracyMeters: fix.accuracyMeters };
    verificationMethod = "network_confirmed";
  }
  const matched = areas.find((area: any) => String(area._id) === String(match.areaId));
  const isPrivateRemote = (member.privateRemoteAreas || []).some((area: any) => String(area._id) === String(match.areaId));
  return { ...match, areaName: matched?.name, mode: matched?.kind === "remote" || isPrivateRemote ? "remote" : "onsite", verificationMethod, observedAt: new Date(fix.capturedAt) };
}

export async function recordLocationCheck(workspaceId: string, userId: string, timeEntryId: string, status: string, fix?: any) {
  const AttendanceLocationEvent = require("../models/AttendanceLocationEvent");
  const TimeEntry = require("../models/TimeEntry");
  const workspace = await loadWorkspace(workspaceId);
  const member = assertActiveMember(workspace, userId);
  if (!workspace.attendanceLocationPolicy?.enabled) throw new AppError("Location checks are not enabled for this workspace", 409);
  if (!mongoose.Types.ObjectId.isValid(timeEntryId)) throw new AppError("Running time entry not found", 404);
  const entry = await TimeEntry.findOne({ _id: timeEntryId, workspace: workspaceId, user: userId, isRunning: true, isDeleted: false }).select("_id");
  if (!entry) throw new AppError("Running time entry not found", 404);
  let result: any;
  if (status === "unavailable") {
    result = { status: "unavailable", reason: "Location unavailable", observedAt: new Date() };
  } else if (status === "location") {
    try {
      result = { ...matchAttendanceArea(fix, eligibleAreasForMember(workspace, member), workspace.attendanceLocationPolicy), status: "inside", observedAt: new Date(fix.capturedAt) };
    } catch (error: any) {
      result = { status: error?.message?.includes("outside") ? "outside" : "unavailable", reason: String(error?.message || "Location check failed").slice(0, 120), observedAt: new Date() };
    }
  } else throw new AppError("Invalid location check status", 400);
  const existingFlag = result.status === "inside" ? null : await AttendanceLocationEvent.findOne({ timeEntry: timeEntryId, activeReviewFlag: true }).select("_id");
  const event = await AttendanceLocationEvent.create({ workspace: workspaceId, user: userId, timeEntry: timeEntryId, areaId: result.areaId, mode: member.attendanceMode || "onsite", status: result.status, observedAt: result.observedAt, accuracyMeters: result.accuracyMeters, distanceMeters: result.distanceMeters, reason: result.reason, activeReviewFlag: result.status !== "inside" && !existingFlag });
  if (result.status === "inside") await AttendanceLocationEvent.updateMany({ timeEntry: timeEntryId, activeReviewFlag: true }, { $set: { activeReviewFlag: false } });
  return event;
}

export async function markStaleLocationChecks(now = new Date()) {
  const AttendanceLocationEvent = require("../models/AttendanceLocationEvent");
  const TimeEntry = require("../models/TimeEntry");
  const workspaces = await Workspace.find({ "attendanceLocationPolicy.enabled": true, isDeleted: { $ne: true } }).select("_id attendanceLocationPolicy members").lean();
  let created = 0;
  for (const workspace of workspaces) {
    const policy = workspace.attendanceLocationPolicy;
    const entries = await TimeEntry.find({ workspace: workspace._id, isRunning: true, isDeleted: false }).select("_id user startTime").limit(5000).lean();
    if (!entries.length) continue;
    const ids = entries.map((entry: any) => entry._id);
    const latestRows = await AttendanceLocationEvent.aggregate([
      { $match: { timeEntry: { $in: ids } } },
      { $sort: { receivedAt: -1 } },
      { $group: { _id: "$timeEntry", receivedAt: { $first: "$receivedAt" }, activeReviewFlag: { $max: { $cond: [{ $eq: ["$activeReviewFlag", true] }, 1, 0] } } } }
    ]);
    const latestByEntry = new Map(latestRows.map((row: any) => [String(row._id), row]));
    const pending: any[] = [];
    for (const entry of entries) {
      const latest: any = latestByEntry.get(String(entry._id));
      if (latest?.activeReviewFlag === 1 || latest?.activeReviewFlag === true) continue;
      const lastAt = latest?.receivedAt || entry.startTime;
      if (now.getTime() - new Date(lastAt).getTime() <= (policy.staleAfterSeconds || 120) * 1000) continue;
      const member = workspace.members?.find((item: any) => String(item.user) === String(entry.user));
      pending.push({ workspace: workspace._id, user: entry.user, timeEntry: entry._id, mode: member?.attendanceMode || "onsite", status: "unavailable", observedAt: now, receivedAt: now, reason: "No recent location update", activeReviewFlag: true });
    }
    if (!pending.length) continue;
    try {
      created += (await AttendanceLocationEvent.insertMany(pending, { ordered: false })).length;
    } catch (error: any) {
      if (error?.code === 11000 || error?.writeErrors?.every((item: any) => item.code === 11000)) continue;
      throw error;
    }
  }
  return created;
}

export async function listLocationChecks(workspaceId: string, member: any, memberId?: string, activeOnly = true) {
  const AttendanceLocationEvent = require("../models/AttendanceLocationEvent");
  return AttendanceLocationEvent.find({ workspace: workspaceId, ...(memberId ? { user: memberId } : {}), ...(activeOnly ? { activeReviewFlag: true } : {}) }).sort({ receivedAt: -1 }).limit(500).select("workspace user timeEntry areaId mode status observedAt receivedAt accuracyMeters distanceMeters activeReviewFlag reason").populate("user", "name email").lean();
}

export { defaults };
