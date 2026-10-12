const Task = require("../models/Task");
const TestExecution = require("../models/TestExecution");
const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const Activity = require("../models/Activity");
const PermissionService = require("../permissions/permission.service");
const notifications = require("./enhancedNotificationService");
const AppError = require("../utils/AppError");

type BugAction = "start" | "ready_for_qa" | "verify" | "reopen" | "close_without_fix";

const transitions: Record<BugAction, { from: string[]; to: string; permission?: string; reasonRequired?: boolean }> = {
  start: { from: ["todo", "review"], to: "inprogress" },
  ready_for_qa: { from: ["inprogress"], to: "review" },
  verify: { from: ["review"], to: "done", permission: "QA_VERIFY_BUG", reasonRequired: true },
  reopen: { from: ["review", "done"], to: "todo", permission: "QA_VERIFY_BUG", reasonRequired: true },
  close_without_fix: { from: ["todo", "inprogress", "review"], to: "cancelled", permission: "QA_TRIAGE_BUG", reasonRequired: true },
};

const activeQaRecipients = async (workspaceId: string, actorId: string, context: any): Promise<string[]> => {
  const workspace = await Workspace.findById(workspaceId).select("members.user members.status members.role");
  const candidates = (workspace?.members || [])
    .filter((member: any) => member.status !== "inactive" && member.user.toString() !== actorId)
    .map((member: any) => member.user.toString());
  const checks = await Promise.all(candidates.map((id: string) => PermissionService.can(id, "QA_VERIFY_BUG", context)));
  return candidates.filter((_id: string, index: number) => checks[index]);
};

const fixContributors = (bug: any): string[] => {
  const history = bug.bugHistory || [];
  const readyForQaIndex = history.map((entry: any) => entry.action).lastIndexOf("ready_for_qa");
  const startIndex = history.map((entry: any) => entry.action).lastIndexOf("start", readyForQaIndex >= 0 ? readyForQaIndex : undefined);
  const ids = [bug.assignee?.toString()];
  if (readyForQaIndex >= 0) ids.push(history[readyForQaIndex].actor?.toString());
  if (startIndex >= 0) ids.push(history[startIndex].actor?.toString());
  return [...new Set(ids.filter(Boolean))];
};

const verificationBlockReason = (bug: any, actorId: string) => {
  const contributors = fixContributors(bug);
  if (!contributors.length) return "Record who handled the fix before verifying this bug";
  if (contributors.includes(actorId)) return "The person who handled the fix cannot verify it";
  return undefined;
};

export const listVerificationRetests = async (taskId: string, actorId: string) => {
  const bug = await Task.findOne({ _id: taskId, isDeleted: false });
  if (!bug || bug.workItemType !== "bug") throw new AppError("Bug not found", 404);
  const context = {
    workspaceId: bug.workspace.toString(), spaceId: bug.space.toString(), listId: bug.list.toString(),
    resourceType: "task", resourceId: taskId, userId: actorId,
  };
  if (!await PermissionService.can(actorId, "VIEW_TASK", context)) throw new AppError("You cannot access this bug", 403);
  if (!await PermissionService.can(actorId, "QA_VERIFY_BUG", context)) throw new AppError("You cannot verify this bug", 403);

  const executionFilter: any = { workspace: bug.workspace.toString(), bugIds: taskId, result: "pass" };
  if (bug.qaProject) executionFilter.project = bug.qaProject;
  const retests = await TestExecution.find(executionFilter)
    .select("caseKey snapshot.title run updatedAt")
    .populate("run", "build environment platform status")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(100)
    .lean();
  const candidateFilter: any = {
    workspace: bug.workspace.toString(),
    result: "pass",
    bugIds: { $ne: bug._id },
  };
  if (bug.qaProject) candidateFilter.project = bug.qaProject;
  if (bug.qaSourceCaseKey) candidateFilter.caseKey = bug.qaSourceCaseKey;
  const availableRetests = await TestExecution.find(candidateFilter)
    .select("caseKey snapshot.title run updatedAt")
    .populate("run", "build environment platform status")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(100)
    .lean();
  const verificationBlockedReason = verificationBlockReason(bug, actorId);
  return { retests, availableRetests, canVerify: !verificationBlockedReason, verificationBlockedReason };
};

export const linkPassingRetest = async (taskId: string, executionId: string, actorId: string) => {
  if (!mongoose.isValidObjectId(executionId)) throw new AppError("Retest ID is invalid", 400);
  const bug = await Task.findOne({ _id: taskId, isDeleted: false });
  if (!bug || bug.workItemType !== "bug") throw new AppError("Bug not found", 404);
  const context = {
    workspaceId: bug.workspace.toString(), spaceId: bug.space.toString(), listId: bug.list.toString(),
    resourceType: "task", resourceId: taskId, userId: actorId,
  };
  if (!await PermissionService.can(actorId, "VIEW_TASK", context)) throw new AppError("You cannot access this bug", 403);
  if (!await PermissionService.can(actorId, "QA_VERIFY_BUG", context)) throw new AppError("You cannot link a retest to this bug", 403);
  const filter: any = { _id: executionId, workspace: bug.workspace.toString(), result: "pass" };
  if (bug.qaProject) filter.project = bug.qaProject;
  if (bug.qaSourceCaseKey) filter.caseKey = bug.qaSourceCaseKey;
  const execution = await TestExecution.findOne(filter);
  if (!execution) throw new AppError("Passing retest not found in this QA project for the bug's test case", 404);
  await TestExecution.updateOne(
    { _id: executionId, workspace: bug.workspace.toString(), ...(bug.qaProject && { project: bug.qaProject }), result: "pass" },
    { $addToSet: { bugIds: bug._id } },
  );
  return { taskId: bug._id, executionId };
};

export const transitionBug = async (
  taskId: string,
  action: BugAction,
  actorId: string,
  input: { idempotencyKey: string; reason?: string; executionId?: string },
) => {
  const rule = transitions[action];
  if (!rule) throw new AppError("Unknown bug handoff action", 400);
  const key = input?.idempotencyKey?.trim();
  if (!key || key.length > 100) throw new AppError("Idempotency key is required", 400);

  const bug = await Task.findOne({ _id: taskId, isDeleted: false });
  if (!bug || bug.workItemType !== "bug") throw new AppError("Bug not found", 404);

  const context = {
    workspaceId: bug.workspace.toString(),
    spaceId: bug.space.toString(),
    listId: bug.list.toString(),
    resourceType: "task",
    resourceId: taskId,
    userId: actorId,
  };
  if (!await PermissionService.can(actorId, "VIEW_TASK", context)) {
    throw new AppError("You cannot access this bug", 403);
  }
  const canTriage = async () => PermissionService.can(actorId, "QA_TRIAGE_BUG", context);
  if (rule.permission) {
    if (!await PermissionService.can(actorId, rule.permission, context)) {
      throw new AppError("You cannot perform this bug handoff action", 403);
    }
  } else if (bug.assignee?.toString() !== actorId && !await canTriage()) {
    throw new AppError("Only the assigned developer or a bug triager can move this bug", 403);
  }

  if ((bug.qualityTransitionKeys || []).includes(key)) {
    const prior = (bug.bugHistory || []).find((entry: any) => entry.idempotencyKey === key);
    if (prior?.actor?.toString() !== actorId || prior?.action !== action) {
      throw new AppError("Idempotency key was already used for another action", 409);
    }
    return bug;
  }

  if (rule.reasonRequired && !input.reason?.trim()) {
    throw new AppError("A retest or closure reason is required", 400);
  }
  if (action === "verify") {
    const blockedReason = verificationBlockReason(bug, actorId);
    if (blockedReason) {
      throw new AppError(blockedReason, fixContributors(bug).includes(actorId) ? 403 : 409);
    }
    if (!input.executionId) {
      throw new AppError("A linked passing retest is required to verify", 400);
    }
  }
  if (input.executionId) {
    if (action !== "verify" && action !== "reopen") throw new AppError("A retest can only verify or reopen a bug", 400);
    if (!mongoose.isValidObjectId(input.executionId)) throw new AppError("Retest ID is invalid", 400);
    const executionFilter: any = { _id: input.executionId, workspace: bug.workspace.toString(), bugIds: taskId };
    if (bug.qaProject) executionFilter.project = bug.qaProject;
    const execution = await TestExecution.findOne(executionFilter);
    if (!execution) throw new AppError("Linked retest not found in this workspace", 400);
    if (action === "verify" && execution.result !== "pass") throw new AppError("A passing retest is required to verify", 409);
    if (action === "reopen" && !["fail", "blocked"].includes(execution.result)) throw new AppError("A failed or blocked retest is required to reopen", 409);
  }
  if (!rule.from.includes(bug.status)) {
    throw new AppError(`Cannot ${action} a bug in ${bug.status}`, 409);
  }

  const audit = {
    action,
    from: bug.status,
    to: rule.to,
    actor: actorId,
    reason: input.reason?.trim(),
    executionId: input.executionId,
    idempotencyKey: key,
    at: new Date(),
  };
  const update: any = {
    $set: { status: rule.to },
    $push: {
      qualityTransitionKeys: { $each: [key], $slice: -100 },
      bugHistory: { $each: [audit], $slice: -200 },
    },
  };
  if (rule.to === "done") {
    update.$set.completedAt = new Date();
    update.$set.completedBy = actorId;
  } else if (bug.status === "done") {
    update.$unset = { completedAt: 1, completedBy: 1 };
  }

  const updated = await Task.findOneAndUpdate(
    { _id: taskId, status: bug.status, isDeleted: false, qualityTransitionKeys: { $ne: key } },
    update,
    { new: true, runValidators: true },
  );
  if (!updated) {
    const current = await Task.findOne({ _id: taskId, isDeleted: false });
    if ((current?.qualityTransitionKeys || []).includes(key)) {
      const prior = (current.bugHistory || []).find((entry: any) => entry.idempotencyKey === key);
      if (prior?.actor?.toString() === actorId && prior?.action === action) return current;
      throw new AppError("Idempotency key was already used for another action", 409);
    }
    throw new AppError("Bug changed while processing this action; refresh and try again", 409);
  }

  try {
    await Activity.create({
      task: taskId,
      workspace: bug.workspace,
      user: actorId,
      type: "update",
      fieldChanged: "status",
      oldValue: bug.status,
      newValue: rule.to,
      metadata: { action, reason: audit.reason, executionId: audit.executionId },
    });
  } catch (error) {
    // The authoritative status and audit are saved atomically on the bug.
    console.error("Could not mirror bug transition in Activity", error);
  }

  let recipients: string[] = [];
  let title = "Bug updated";
  if (action === "ready_for_qa") {
    title = "Bug ready for QA";
    const owner = bug.qaReviewer?.toString() || bug.createdBy?.toString();
    if (owner && await PermissionService.can(owner, "QA_VERIFY_BUG", { ...context, userId: owner })) {
      recipients = [owner];
    } else {
      recipients = await activeQaRecipients(bug.workspace.toString(), actorId, context);
    }
  } else if (action === "reopen") {
    title = "Bug reopened";
    if (bug.assignee) recipients = [bug.assignee.toString()];
  } else if (action === "verify") {
    title = "Bug verified";
    if (bug.assignee) recipients = [bug.assignee.toString()];
  } else if (action === "close_without_fix") {
    title = "Bug closed without a fix";
    if (bug.createdBy) recipients = [bug.createdBy.toString()];
  }

  await Promise.allSettled([...new Set(recipients.filter(id => id !== actorId))].map(recipientId =>
    notifications.createNotification({
      recipientId,
      type: "TASK_STATUS_CHANGED",
      title,
      body: `${bug.title}${audit.reason ? ` — ${audit.reason}` : ""}`.slice(0, 1000),
      data: { resourceId: taskId, resourceType: "Task", taskId, workspaceId: bug.workspace.toString(), action, executionId: input.executionId },
    })
  ));
  return updated;
};
