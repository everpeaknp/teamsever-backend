const Workspace = require("../models/Workspace");
const QaModule = require("../models/QaModule");
const TestSuite = require("../models/TestSuite");
const TestCase = require("../models/TestCase");
const TestCaseRevision = require("../models/TestCaseRevision");
const QaProject = require("../models/QaProject");
const Task = require("../models/Task");
const service = require("../services/testCaseService");
const qaProjectService = require("../services/qaProjectService");
const mongoose = require("mongoose");

const workspaceId = "507f1f77bcf86cd799439011";
const otherWorkspaceId = "507f1f77bcf86cd799439012";
const actorId = "507f1f77bcf86cd799439013";
const moduleId = "507f1f77bcf86cd799439014";
const suiteId = "507f1f77bcf86cd799439015";
const taskId = "507f1f77bcf86cd799439016";
const caseId = "507f1f77bcf86cd799439017";
const workspaceProjectId = "507f1f77bcf86cd799439018";
const steps = [{ action: "Open sign-in", expectedResult: "Form appears" }, { action: "Submit Google", expectedResult: "Dashboard appears" }];

describe("QA case library", () => {
  beforeEach(() => {
    jest.spyOn(qaProjectService, "getProjectScope").mockResolvedValue({
      project: { _id: workspaceProjectId, scopeType: "workspace", folder: null },
      filter: { project: { $in: [workspaceProjectId, null] } },
    });
    jest.spyOn(qaProjectService, "getEffectiveSettings").mockResolvedValue(qaProjectService.DEFAULTS);
  });

  afterEach(() => jest.restoreAllMocks());

  it("validates ordered, complete steps before saving", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    const create = jest.spyOn(TestCase, "create");
    await expect(service.createCase(workspaceId, actorId, { title: "Google sign-in", steps: [{ action: "Click", expectedResult: "" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace module, suite, and work-item references", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(QaModule, "findOne").mockResolvedValue(null);
    await expect(service.createCase(workspaceId, actorId, { title: "Google sign-in", steps, moduleId }))
      .rejects.toMatchObject({ statusCode: 400 });
    jest.spyOn(QaModule, "findOne").mockResolvedValue({ _id: moduleId });
    jest.spyOn(TestSuite, "findOne").mockResolvedValue(null);
    await expect(service.createCase(workspaceId, actorId, { title: "Google sign-in", steps, moduleId, suiteId }))
      .rejects.toMatchObject({ statusCode: 400 });
    jest.spyOn(TestSuite, "findOne").mockResolvedValue({ _id: suiteId });
    jest.spyOn(Task, "countDocuments").mockResolvedValue(0);
    await expect(service.createCase(workspaceId, actorId, { title: "Google sign-in", steps, moduleId, suiteId, linkedTaskIds: [taskId] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(Task.countDocuments).toHaveBeenCalledWith({ _id: { $in: [taskId] }, workspace: workspaceId, isDeleted: false });
  });

  it("allocates a stable workspace key and stores revision one", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(Workspace, "findOneAndUpdate").mockResolvedValue({ qualityCaseSequence: 14 });
    const nextProjectCase = jest.spyOn(QaProject, "findOneAndUpdate").mockResolvedValue({ caseSequence: 14 });
    jest.spyOn(QaModule, "findOne").mockResolvedValue({ _id: moduleId });
    const createdCase = { _id: caseId, key: "TC-014", currentRevision: 1 };
    jest.spyOn(TestCase, "create").mockResolvedValue(createdCase);
    const revision = jest.spyOn(TestCaseRevision, "create").mockResolvedValue({ _id: "revision" });
    const result = await service.createCase(workspaceId, actorId, { title: "Google sign-in", steps, moduleId });
    expect(nextProjectCase).toHaveBeenCalledWith(
      { _id: workspaceProjectId, workspace: workspaceId, isArchived: false },
      { $inc: { caseSequence: 1 } },
      { new: true, projection: "caseSequence" },
    );
    expect(TestCase.create).toHaveBeenCalledWith(expect.objectContaining({ workspace: workspaceId, project: workspaceProjectId, key: "TC-014", currentRevision: 1, title: "Google sign-in" }));
    expect(revision).toHaveBeenCalledWith(expect.objectContaining({ workspace: workspaceId, project: workspaceProjectId, testCase: caseId, revision: 1, snapshot: expect.objectContaining({ title: "Google sign-in", steps }) }));
    expect(result).toBe(createdCase);
  });

  it("paginates by workspace and filters without loading the whole library", async () => {
    const query: any = { sort: jest.fn(() => query), skip: jest.fn(() => query), limit: jest.fn(() => query), lean: jest.fn().mockResolvedValue([{ key: "TC-014" }]) };
    const find = jest.spyOn(TestCase, "find").mockReturnValue(query);
    jest.spyOn(TestCase, "countDocuments").mockResolvedValue(21);
    const result = await service.listCases(workspaceId, { state: "active", moduleId, search: "Google", page: 2, limit: 10 });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ workspace: workspaceId, project: { $in: [workspaceProjectId, null] }, state: "active", moduleId, $or: expect.any(Array) }));
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21 });
  });

  it("returns a conflict and preserves the old revision when the expected revision is stale", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestCase, "findOne").mockResolvedValue({ _id: caseId, workspace: workspaceId, currentRevision: 3 });
    const update = jest.spyOn(TestCase, "findOneAndUpdate");
    const revision = jest.spyOn(TestCaseRevision, "create");
    await expect(service.updateCase(workspaceId, caseId, actorId, 2, { title: "New title" }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(update).not.toHaveBeenCalled();
    expect(revision).not.toHaveBeenCalled();
  });

  it("updates a case with stored ObjectId references and appends a new snapshot", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    const stored = { _id: caseId, workspace: workspaceId, key: "TC-014", title: "Old", state: "draft", currentRevision: 1,
      moduleId: new mongoose.Types.ObjectId(moduleId), steps,
      toObject() { return { ...this }; } };
    jest.spyOn(TestCase, "findOne").mockResolvedValue(stored);
    jest.spyOn(QaModule, "findOne").mockResolvedValue({ _id: moduleId });
    const updated = { ...stored, title: "New", currentRevision: 2 };
    const save = jest.spyOn(TestCase, "findOneAndUpdate").mockResolvedValue(updated);
    const revision = jest.spyOn(TestCaseRevision, "create").mockResolvedValue({});
    const result = await service.updateCase(workspaceId, caseId, actorId, 1, { title: "New" });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ workspace: workspaceId, project: { $in: [workspaceProjectId, null] }, currentRevision: 1 }), expect.any(Object), expect.any(Object));
    expect(revision).toHaveBeenCalledWith(expect.objectContaining({ project: workspaceProjectId, revision: 2, snapshot: expect.objectContaining({ title: "New" }) }));
    expect(result.currentRevision).toBe(2);
  });

  it("loads only the requested workspace's historical revision", async () => {
    const lookup = jest.spyOn(TestCaseRevision, "findOne").mockResolvedValue(null);
    await expect(service.getCaseRevision(workspaceId, caseId, 2)).rejects.toMatchObject({ statusCode: 404 });
    expect(lookup).toHaveBeenCalledWith({ workspace: workspaceId, testCase: caseId, project: { $in: [workspaceProjectId, null] }, revision: 2 });
  });
});
