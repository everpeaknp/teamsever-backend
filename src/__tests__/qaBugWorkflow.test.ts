const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const taskDependencyService = require("../services/taskDependencyService");
const PermissionService = require("../permissions/permission.service");
const taskService = require("../services/taskService");

const taskId = "507f1f77bcf86cd799439011";
const actorId = "507f1f77bcf86cd799439012";

describe("bug handoff", () => {
  beforeEach(() => {
    jest.spyOn(Workspace, "findById").mockImplementation(() => { throw new Error("Generic done path reached"); });
    jest.spyOn(taskDependencyService, "canTransitionToStatus").mockImplementation(() => { throw new Error("Generic status path reached"); });
  });
  afterEach(() => jest.restoreAllMocks());

  it("does not allow the generic task PATCH to verify a bug", async () => {
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: taskId, workItemType: "bug", status: "review" });
    await expect(taskService.updateTask(taskId, actorId, { status: "done" })).rejects.toMatchObject({ statusCode: 403, message: "Use the bug handoff action to change status" });
  });

  it("does not allow the generic task PATCH to move a bug to review", async () => {
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: taskId, workItemType: "bug", status: "inprogress" });
    await expect(taskService.updateTask(taskId, actorId, { status: "review" })).rejects.toMatchObject({ statusCode: 403, message: "Use the bug handoff action to change status" });
  });

  it("does not let an ordinary task editor reassign a bug without triage access", async () => {
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: taskId, workItemType: "bug", status: "todo", workspace: taskId, space: taskId, list: taskId, assignee: actorId });
    jest.spyOn(PermissionService, "can").mockResolvedValue(false);
    await expect(taskService.updateTask(taskId, actorId, { assignee: "507f1f77bcf86cd799439099" }))
      .rejects.toMatchObject({ statusCode: 403, message: "Bug reassignment requires triage permission" });
  });
});
