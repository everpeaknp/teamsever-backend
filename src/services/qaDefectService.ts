const mongoose = require("mongoose");
const TestExecution = require("../models/TestExecution");
const TestRun = require("../models/TestRun");
const Task = require("../models/Task");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const taskService = require("./taskService");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

export const createOrLinkBug = async (workspaceId: string, executionId: string, actorId: string, input: any, projectId = "workspace") => {
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const key = typeof input?.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  if (typeof key !== "string" || !key || key.length > 100) throw new AppError("Idempotency key is required", 400);
  const execution = await TestExecution.findOne({ _id: executionId, workspace: workspaceId, ...scope.filter });
  if (!execution) throw new AppError("Execution not found", 404);
  if (execution.assignedTo && execution.assignedTo.toString() !== actorId &&
      !await PermissionService.can(actorId, "MANAGE_PLAN", { workspaceId, userId: actorId })) {
    throw new AppError("This execution is assigned to another tester", 403);
  }
  if (input.existingBugId && input.targetListId) throw new AppError("Choose either an existing bug or a target list", 400);

  if (input.existingBugId) {
    if (!mongoose.isValidObjectId(input.existingBugId)) throw new AppError("Bug ID is invalid", 400);
    const bug = await Task.findOne({ _id: input.existingBugId, workspace: workspaceId, workItemType: "bug", isDeleted: false });
    if (!bug) throw new AppError("Bug not found", 404);
    const canView = await PermissionService.can(actorId, "VIEW_TASK", { workspaceId, spaceId: bug.space.toString(), listId: bug.list.toString(), resourceType: "task", resourceId: bug._id.toString(), userId: actorId });
    if (!canView) throw new AppError("You cannot link this bug", 403);
    await TestExecution.updateOne({ _id: executionId, workspace: workspaceId, ...scope.filter }, { $addToSet: { bugIds: bug._id } });
    return bug;
  }

  if (!["fail", "blocked"].includes(execution.result)) throw new AppError("Only a failed or blocked execution can create a bug", 409);
  const targetListId = input.targetListId || settings.bugHandoff.defaultListId;
  if (!targetListId || !mongoose.isValidObjectId(targetListId)) throw new AppError("Choose a target list", 400);
  const list = await List.findOne({ _id: targetListId, workspace: workspaceId, isDeleted: false });
  if (!list) throw new AppError("Target list is not in this workspace", 400);
  if (scope.project.scopeType === "folder" && (!scope.project.folder || list.folderId?.toString() !== scope.project.folder.toString())) throw new AppError("Choose a list inside this QA project's folder", 400);
  const context = { workspaceId, spaceId: list.space.toString(), listId: input.targetListId, userId: actorId };
  if (!await PermissionService.can(actorId, "VIEW_LIST", context) || !await PermissionService.can(actorId, "CREATE_BUG", context)) {
    throw new AppError("You cannot report a bug in this list", 403);
  }

  let bug = await Task.findOne({ workspace: workspaceId, qaProject: scope.project._id, qaCreationKey: key, workItemType: "bug", isDeleted: false });
  if (bug) {
    if (bug.qaSourceExecution?.toString() !== executionId) throw new AppError("Idempotency key was used for another execution", 409);
  } else {
    const run = await TestRun.findOne({ _id: execution.run, workspace: workspaceId, ...scope.filter });
    if (!run) throw new AppError("Test run not found", 404);
    const frozen = execution.snapshot;
    const expectedResult = frozen.steps.map((step: any, index: number) => `${index + 1}. ${step.expectedResult}`).join("\n").slice(0, 3000);
    const actualResult = [execution.reason, ...(execution.stepResults || []).map((step: any, index: number) => step.actualResult ? `${index + 1}. ${step.actualResult}` : "").filter(Boolean)].filter(Boolean).join("\n").slice(0, 3000) || "Execution failed; see linked QA result.";
    const reproductionSteps = frozen.steps.map((step: any, index: number) => `${index + 1}. ${step.action}`).join("\n").slice(0, 5000);
    const severity = ["low", "medium", "high", "critical"].includes(input.severity) ? input.severity : "medium";
    const priority = severity === "critical" ? "urgent" : severity === "high" ? "high" : severity === "low" ? "low" : "medium";
    try {
      const description = settings.bugHandoff.copyRunContext ? `QA project: ${scope.project.name}\nBuild: ${run.build}\nEnvironment: ${run.environment}\nCase: ${execution.caseKey}` : undefined;
      bug = await taskService.createTask({
        list: targetListId, title: `${frozen.title} failed`.slice(0, 200), workItemType: "bug", description,
        qaProject: scope.project._id,
        moduleId: frozen.moduleId, qaReviewer: actorId, qaSourceExecution: executionId, qaCreationKey: key,
        bugDetails: { reproductionSteps, expectedResult, actualResult, severity, environment: run.environment, build: run.build },
        status: "todo", priority, assignee: input.assigneeId, createdBy: actorId,
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      bug = await Task.findOne({ workspace: workspaceId, qaProject: scope.project._id, qaCreationKey: key, workItemType: "bug", isDeleted: false });
      if (!bug || bug.qaSourceExecution?.toString() !== executionId) throw new AppError("Idempotency key was used for another execution", 409);
    }
  }
  await TestExecution.updateOne({ _id: executionId, workspace: workspaceId, ...scope.filter }, { $addToSet: { bugIds: bug._id } });
  return bug;
};
