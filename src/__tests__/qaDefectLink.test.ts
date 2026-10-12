const TestExecution = require("../models/TestExecution");
const TestRun = require("../models/TestRun");
const Task = require("../models/Task");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const taskService = require("../services/taskService");
const service = require("../services/qaDefectService");
const qaProjectService = require("../services/qaProjectService");

const wid = "507f1f77bcf86cd799439011";
const eid = "507f1f77bcf86cd799439012";
const rid = "507f1f77bcf86cd799439013";
const lid = "507f1f77bcf86cd799439014";
const sid = "507f1f77bcf86cd799439015";
const actor = "507f1f77bcf86cd799439016";
const bid = "507f1f77bcf86cd799439017";
const projectId = "507f1f77bcf86cd799439018";

describe("execution failure to developer bug", () => {
  beforeEach(() => {
    jest.spyOn(qaProjectService, "getProjectScope").mockResolvedValue({ project: { _id: projectId, name: "Yummy", scopeType: "workspace", folder: null }, filter: { project: projectId } });
    jest.spyOn(qaProjectService, "getEffectiveSettings").mockResolvedValue({ bugHandoff: { defaultListId: null, copyRunContext: true } });
  });
  afterEach(() => jest.restoreAllMocks());

  it("does not let another tester create or link a bug on an assigned execution", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, assignedTo: bid, result: "fail", run: rid });
    jest.spyOn(PermissionService, "can").mockResolvedValue(false);
    const findBug = jest.spyOn(Task, "findOne");
    await expect(service.createOrLinkBug(wid, eid, actor, { existingBugId: bid, idempotencyKey: "once" }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(findBug).not.toHaveBeenCalled();
  });

  it("rejects a target list in another workspace", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid });
    jest.spyOn(List, "findOne").mockResolvedValue(null);
    const create = jest.spyOn(taskService, "createTask");
    await expect(service.createOrLinkBug(wid, eid, actor, { targetListId: lid, idempotencyKey: "once" }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
    expect(List.findOne).toHaveBeenCalledWith({ _id: lid, workspace: wid, isDeleted: false });
  });

  it("prefills a new bug from frozen steps, result, build and environment", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, caseKey: "TC-001", snapshot: { title: "Google sign-in", moduleId: undefined, steps: [{ action: "Open login", expectedResult: "Form appears" }] }, stepResults: [{ result: "fail", actualResult: "Blank screen" }], reason: "Failure screenshot", bugIds: [] });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, workspace: wid, space: sid });
    jest.spyOn(TestRun, "findOne").mockResolvedValue({ _id: rid, build: "1.8.5", environment: "Android 16" });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(Task, "findOne").mockResolvedValue(null);
    const create = jest.spyOn(taskService, "createTask").mockResolvedValue({ _id: bid, workItemType: "bug" });
    const link = jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const bug = await service.createOrLinkBug(wid, eid, actor, { targetListId: lid, idempotencyKey: "once", assigneeId: actor, dueDate: "2026-10-20" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workItemType: "bug", list: lid, qaProjectName: "Yummy", qaSourceExecution: eid, qaSourceRun: rid, qaSourceCaseKey: "TC-001", dueDate: new Date("2026-10-20T00:00:00.000Z"), assignee: actor, qaCreationKey: "once", bugDetails: expect.objectContaining({ build: "1.8.5", environment: "Android 16", expectedResult: "1. Form appears", actualResult: expect.stringContaining("Blank screen") }) }));
    expect(link).toHaveBeenCalledWith({ _id: eid, workspace: wid, project: projectId }, { $addToSet: { bugIds: bid } });
    expect(bug._id).toBe(bid);
  });

  it("retries the same key without creating a second bug", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, bugIds: [] });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, workspace: wid, space: sid });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: bid, qaSourceExecution: eid, qaCreationKey: "once" });
    jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const create = jest.spyOn(taskService, "createTask");
    const bug = await service.createOrLinkBug(wid, eid, actor, { targetListId: lid, idempotencyKey: "once" });
    expect(create).not.toHaveBeenCalled();
    expect(bug._id).toBe(bid);
  });

  it("denies linking a bug from another workspace", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, bugIds: [] });
    jest.spyOn(Task, "findOne").mockResolvedValue(null);
    await expect(service.createOrLinkBug(wid, eid, actor, { existingBugId: bid, idempotencyKey: "once" }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(Task.findOne).toHaveBeenCalledWith({ _id: bid, workspace: wid, qaProject: expect.anything(), workItemType: "bug", isDeleted: false });
  });

  it("links a passing retest to an existing bug without creating a new one", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "pass", run: rid, bugIds: [] });
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: bid, workspace: wid, workItemType: "bug", space: sid, list: lid });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    const link = jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const create = jest.spyOn(taskService, "createTask");
    await service.createOrLinkBug(wid, eid, actor, { existingBugId: bid, idempotencyKey: "retest" });
    expect(link).toHaveBeenCalledWith({ _id: eid, workspace: wid, project: projectId }, { $addToSet: { bugIds: bid } });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects linking a bug from a different QA project", async () => {
    jest.spyOn(qaProjectService, "getProjectScope").mockResolvedValue({ project: { _id: projectId, scopeType: "folder", folder: lid }, filter: { project: projectId } });
    jest.spyOn(qaProjectService, "getEffectiveSettings").mockResolvedValue({ bugHandoff: { defaultListId: null, copyRunContext: true } });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, bugIds: [] });
    const findBug = jest.spyOn(Task, "findOne").mockResolvedValue(null);
    await expect(service.createOrLinkBug(wid, eid, actor, { existingBugId: bid, idempotencyKey: "wrong-project" }, projectId))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(findBug).toHaveBeenCalledWith({ _id: bid, workspace: wid, qaProject: projectId, workItemType: "bug", isDeleted: false });
  });

  it("rejects malformed target fix dates before task creation", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, snapshot: { title: "Login", steps: [] }, bugIds: [] });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, workspace: wid, space: sid });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    const create = jest.spyOn(taskService, "createTask");
    await expect(service.createOrLinkBug(wid, eid, actor, { targetListId: lid, idempotencyKey: "bad-date", dueDate: "2026-02-31" }))
      .rejects.toMatchObject({ statusCode: 400, message: "Target fix date must be a valid date" });
    expect(create).not.toHaveBeenCalled();
  });
});
