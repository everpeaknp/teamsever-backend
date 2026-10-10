const TestExecution = require("../models/TestExecution");
const TestRun = require("../models/TestRun");
const Task = require("../models/Task");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const taskService = require("../services/taskService");
const service = require("../services/qaDefectService");

const wid = "507f1f77bcf86cd799439011";
const eid = "507f1f77bcf86cd799439012";
const rid = "507f1f77bcf86cd799439013";
const lid = "507f1f77bcf86cd799439014";
const sid = "507f1f77bcf86cd799439015";
const actor = "507f1f77bcf86cd799439016";
const bid = "507f1f77bcf86cd799439017";

describe("execution failure to developer bug", () => {
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
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "fail", run: rid, snapshot: { title: "Google sign-in", moduleId: undefined, steps: [{ action: "Open login", expectedResult: "Form appears" }] }, stepResults: [{ result: "fail", actualResult: "Blank screen" }], reason: "Failure screenshot", bugIds: [] });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, workspace: wid, space: sid });
    jest.spyOn(TestRun, "findOne").mockResolvedValue({ _id: rid, build: "1.8.5", environment: "Android 16" });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(Task, "findOne").mockResolvedValue(null);
    const create = jest.spyOn(taskService, "createTask").mockResolvedValue({ _id: bid, workItemType: "bug" });
    const link = jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const bug = await service.createOrLinkBug(wid, eid, actor, { targetListId: lid, idempotencyKey: "once", assigneeId: actor });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workItemType: "bug", list: lid, qaSourceExecution: eid, qaCreationKey: "once", bugDetails: expect.objectContaining({ build: "1.8.5", environment: "Android 16", expectedResult: "1. Form appears", actualResult: expect.stringContaining("Blank screen") }) }));
    expect(link).toHaveBeenCalledWith({ _id: eid, workspace: wid }, { $addToSet: { bugIds: bid } });
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
    expect(Task.findOne).toHaveBeenCalledWith({ _id: bid, workspace: wid, workItemType: "bug", isDeleted: false });
  });

  it("links a passing retest to an existing bug without creating a new one", async () => {
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: eid, workspace: wid, result: "pass", run: rid, bugIds: [] });
    jest.spyOn(Task, "findOne").mockResolvedValue({ _id: bid, workspace: wid, workItemType: "bug", space: sid, list: lid });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    const link = jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const create = jest.spyOn(taskService, "createTask");
    await service.createOrLinkBug(wid, eid, actor, { existingBugId: bid, idempotencyKey: "retest" });
    expect(link).toHaveBeenCalledWith({ _id: eid, workspace: wid }, { $addToSet: { bugIds: bid } });
    expect(create).not.toHaveBeenCalled();
  });
});
