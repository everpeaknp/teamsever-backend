import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";
const asyncHandler = require("../utils/asyncHandler");
const PermissionService = require("../permissions/permission.service");
const Service = require("../services/attendanceLocationService");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");

const canManageLegacyLocations = async (userId: string, workspaceId: string) => PermissionService.can(userId, "MANAGE_ATTENDANCE_LOCATIONS", { userId, workspaceId });
const canManageAddresses = async (userId: string, workspaceId: string) => (await PermissionService.can(userId, "MANAGE_ADDRESSES", { userId, workspaceId })) || canManageLegacyLocations(userId, workspaceId);
const canManage = canManageAddresses;

const getLocationPolicy = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const workspace = await Service.loadWorkspace(workspaceId);
  const member = Service.assertActiveMember(workspace, req.user!.id);
  const manager = await canManageAddresses(req.user!.id, workspaceId);
  const policy = workspace.attendanceLocationPolicy?.toObject?.() || workspace.attendanceLocationPolicy || Service.defaults;
  const TimeEntry = require("../models/TimeEntry");
  const runningTimeEntry = policy.enabled ? await TimeEntry.findOne({ workspace: workspaceId, user: req.user!.id, isRunning: true, isDeleted: false }).select("_id startTime attendanceMode") : null;
  const areas = manager
    ? policy.areas
    : Service.eligibleAreasForMember(workspace, member).map((area: any) => ({ _id: area._id, name: area.name, kind: area.kind || "remote", radiusMeters: area.radiusMeters, isActive: area.isActive }));
  res.json({ success: true, data: { policy: { enabled: policy.enabled, maxAccuracyMeters: policy.maxAccuracyMeters, checkIntervalSeconds: policy.checkIntervalSeconds, staleAfterSeconds: policy.staleAfterSeconds, areas }, member: { attendanceMode: member.attendanceMode || "onsite", remoteAreas: (member.privateRemoteAreas || []).map((area: any) => ({ _id: area._id, name: area.name, latitude: area.latitude, longitude: area.longitude, radiusMeters: area.radiusMeters, isActive: area.isActive })) }, runningTimeEntry: runningTimeEntry ? { _id: runningTimeEntry._id, startTime: runningTimeEntry.startTime } : null, canManage: manager } });
});

const getLocationAssignments = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  if (!(await canManage(req.user!.id, workspaceId))) return next(new AppError("You do not have permission to manage attendance locations", 403));
  const workspace = await Service.loadWorkspace(workspaceId);
  Service.assertActiveMember(workspace, req.user!.id);
  const User = require("../models/User");
  const members = [...workspace.members];
  if (!members.some((member: any) => String(member.user) === String(workspace.owner))) members.unshift({ user: workspace.owner, role: "owner", attendanceMode: "onsite", assignedRemoteLocationIds: [] });
  const ids = members.map((member: any) => member.user);
  const users = await User.find({ _id: { $in: ids } }).select("name email").lean();
  const usersById = new Map<string, any>(users.map((user: any) => [String(user._id), user]));
  res.json({ success: true, data: { members: members.map((member: any) => ({
    id: String(member.user),
    name: usersById.get(String(member.user))?.name || usersById.get(String(member.user))?.email || "Workspace member",
    role: member.role,
    attendanceMode: member.attendanceMode || "onsite",
    remoteAreaIds: [],
    remoteAreas: (member.privateRemoteAreas || []).map((area: any) => ({ _id: area._id, name: area.name, latitude: area.latitude, longitude: area.longitude, radiusMeters: area.radiusMeters, isActive: area.isActive, networkIp: area.networkIp }))
  })) } });
});

const updateLocationPolicy = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  if (!(await canManage(req.user!.id, workspaceId))) return next(new AppError("You do not have permission to manage attendance locations", 403));
  const workspace = await Service.updateLocationPolicy(workspaceId, req.user!.id, req.body);
  res.json({ success: true, data: { policy: workspace.attendanceLocationPolicy } });
});

const assignMemberAttendanceLocations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  if (!(await canManage(req.user!.id, workspaceId))) return next(new AppError("You do not have permission to manage attendance locations", 403));
  const member = await Service.assignMemberAttendanceLocations(workspaceId, req.user!.id, String(req.params.memberId), req.body);
  res.json({ success: true, data: { member: { user: member.user, attendanceMode: member.attendanceMode, assignedRemoteLocationIds: member.assignedRemoteLocationIds } } });
});

const updateMemberRemoteAreas = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  if (!(await canManageAddresses(req.user!.id, workspaceId))) return next(new AppError("You do not have permission to manage office and member addresses", 403));
  const member = await Service.updateMemberRemoteAreas(workspaceId, req.user!.id, String(req.params.memberId), req.body);
  res.json({ success: true, data: { member: { user: member.user, remoteAreas: member.privateRemoteAreas } } });
});

const postLocationCheck = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const { timeEntryId, status, locationFix } = req.body || {};
  const event = await Service.recordLocationCheck(workspaceId, req.user!.id, String(timeEntryId || ""), status, locationFix);
  res.status(201).json({ success: true, data: { event } });
});

const getLocationChecks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const workspaceId = String(req.params.workspaceId);
  const workspace = await Service.loadWorkspace(workspaceId);
  const member = Service.assertActiveMember(workspace, req.user!.id);
  const canSeeTeam = await canManage(req.user!.id, workspaceId);
  const requestedMemberId = req.query.memberId ? String(req.query.memberId) : undefined;
  if (requestedMemberId && requestedMemberId !== req.user!.id && !canSeeTeam) return next(new AppError("You do not have permission to view team location checks", 403));
  const targetMember = requestedMemberId || (canSeeTeam ? undefined : req.user!.id);
  if (targetMember && (!mongoose.Types.ObjectId.isValid(targetMember) || !workspace.members.some((item: any) => String(item.user) === targetMember) && String(workspace.owner) !== targetMember)) return next(new AppError("Workspace member not found", 404));
  const events = await Service.listLocationChecks(workspaceId, member, targetMember, req.query.history !== "true");
  const filtered = req.query.status ? events.filter((event: any) => event.status === String(req.query.status)) : events;
  res.json({ success: true, data: { events: filtered, canSeeTeam } });
});

module.exports = { getLocationPolicy, getLocationAssignments, updateLocationPolicy, assignMemberAttendanceLocations, updateMemberRemoteAreas, postLocationCheck, getLocationChecks };
export {};
