const Workspace = require("../models/Workspace");
const User = require("../models/User");
const TestCase = require("../models/TestCase");
const TestCaseRevision = require("../models/TestCaseRevision");
const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const Attachment = require("../models/Attachment");
const PermissionService = require("../permissions/permission.service");
const notifications = require("../services/enhancedNotificationService");
const service = require("../services/testRunService");

const wid = "507f1f77bcf86cd799439011";
const other = "507f1f77bcf86cd799439012";
const actor = "507f1f77bcf86cd799439013";
const caseId = "507f1f77bcf86cd799439014";
const planId = "507f1f77bcf86cd799439015";
const runId = "507f1f77bcf86cd799439016";
const executionId = "507f1f77bcf86cd799439017";
const attachmentId = "507f1f77bcf86cd799439018";

describe("QA executions", () => {
  afterEach(() => jest.restoreAllMocks());

  it("lists only testers with execution permission, including clocked-out members", async () => {
    const tester = "507f1f77bcf86cd799439019";
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true, owner: actor, members: [{ user: tester, status: "inactive" }, { user: other, status: "active" }] });
    jest.spyOn(PermissionService, "can").mockImplementation(async (userId: string) => userId !== other);
    const users = jest.spyOn(User, "find").mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [{ _id: actor }, { _id: tester }] }) }) } as any);
    const result = await service.listEligibleTesters(wid);
    expect(users).toHaveBeenCalledWith({ _id: { $in: [actor, tester] } });
    expect(result).toHaveLength(2);
  });

  it("returns selected cases in plan order for assigning individual testers", async () => {
    const secondCaseId = "507f1f77bcf86cd799439020";
    jest.spyOn(TestPlan, "findOne").mockReturnValue({ lean: async () => ({ _id: planId, workspace: wid, caseIds: [caseId, secondCaseId] }) } as any);
    jest.spyOn(TestCase, "find").mockReturnValue({
      select: () => ({ lean: async () => [
        { _id: secondCaseId, key: "TC-020", title: "Second case" },
        { _id: caseId, key: "TC-014", title: "First case" },
      ] }),
    } as any);
    const plan = await service.getPlan(wid, planId);
    expect(plan.cases.map((item: any) => item.key)).toEqual(["TC-014", "TC-020"]);
  });

  it("rejects a plan containing a case from another workspace", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestCase, "countDocuments").mockResolvedValue(0);
    const create = jest.spyOn(TestPlan, "create");
    await expect(service.createPlan(wid, actor, { name: "Release 1", caseIds: [caseId] })).rejects.toMatchObject({ statusCode: 400 });
    expect(TestCase.countDocuments).toHaveBeenCalledWith({ _id: { $in: [caseId] }, workspace: wid, state: { $ne: "retired" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("freezes each selected revision when starting a run", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: planId, workspace: wid, caseIds: [caseId] });
    jest.spyOn(TestCase, "find").mockResolvedValue([{ _id: caseId, key: "TC-014", workspace: wid, currentRevision: 3, state: "active" }]);
    jest.spyOn(TestCaseRevision, "find").mockResolvedValue([{ _id: "revision-3", testCase: caseId, revision: 3, snapshot: { title: "Sign in", steps: [{ action: "Open", expectedResult: "Visible" }] } }]);
    jest.spyOn(TestRun, "create").mockResolvedValue({ _id: runId, build: "1.8.5" });
    const insert = jest.spyOn(TestExecution, "insertMany").mockResolvedValue([]);
    await service.startRun(wid, planId, actor, { build: "1.8.5", environment: "Android 16" });
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ workspace: wid, run: runId, testCase: caseId, caseKey: "TC-014", revision: 3, snapshot: expect.objectContaining({ title: "Sign in" }), result: "not_run" })], { ordered: true });
  });

  it("notifies only assigned testers when their run is ready", async () => {
    const tester = "507f1f77bcf86cd799439019";
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true, members: [{ user: tester, status: "active" }] });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: planId, workspace: wid, caseIds: [caseId] });
    jest.spyOn(TestCase, "find").mockResolvedValue([{ _id: caseId, key: "TC-014", workspace: wid, currentRevision: 1, state: "active" }]);
    jest.spyOn(TestCaseRevision, "find").mockResolvedValue([{ _id: "revision-1", testCase: caseId, revision: 1, snapshot: { title: "Sign in", steps: [{ action: "Open", expectedResult: "Visible" }] } }]);
    jest.spyOn(TestRun, "create").mockResolvedValue({ _id: runId });
    jest.spyOn(TestExecution, "insertMany").mockResolvedValue([]);
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    const send = jest.spyOn(notifications, "createNotification").mockResolvedValue({});
    await service.startRun(wid, planId, actor, { build: "1.8.5", environment: "Android 16", assignments: { [caseId]: tester } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ recipientId: tester, type: "QA_RUN_ASSIGNED", data: expect.objectContaining({ workspaceId: wid, runId }) }));
  });

  it("allows a clocked-out workspace member to be assigned a run", async () => {
    const tester = "507f1f77bcf86cd799439019";
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true, members: [{ user: tester, status: "inactive" }] });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: planId, workspace: wid, caseIds: [caseId] });
    jest.spyOn(TestCase, "find").mockResolvedValue([{ _id: caseId, key: "TC-014", workspace: wid, currentRevision: 1, state: "active" }]);
    jest.spyOn(TestCaseRevision, "find").mockResolvedValue([{ _id: "revision-1", testCase: caseId, revision: 1, snapshot: { title: "Sign in", steps: [{ action: "Open", expectedResult: "Visible" }] } }]);
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(TestRun, "create").mockResolvedValue({ _id: runId });
    const insert = jest.spyOn(TestExecution, "insertMany").mockResolvedValue([]);
    jest.spyOn(notifications, "createNotification").mockResolvedValue({});
    await service.startRun(wid, planId, actor, { build: "1.8.5", environment: "staging", assignments: { [caseId]: tester } });
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ assignedTo: tester })], { ordered: true });
  });

  it("does not assign a run to a member without execution permission", async () => {
    const tester = "507f1f77bcf86cd799439019";
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true, members: [{ user: tester, status: "active" }] });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: planId, workspace: wid, caseIds: [caseId] });
    jest.spyOn(TestCase, "find").mockResolvedValue([{ _id: caseId, key: "TC-014", workspace: wid, currentRevision: 1, state: "active" }]);
    jest.spyOn(TestCaseRevision, "find").mockResolvedValue([{ _id: "revision-1", testCase: caseId, revision: 1, snapshot: { title: "Sign in", steps: [{ action: "Open", expectedResult: "Visible" }] } }]);
    jest.spyOn(PermissionService, "can").mockResolvedValue(false);
    const create = jest.spyOn(TestRun, "create");
    await expect(service.startRun(wid, planId, actor, { build: "1.8.5", environment: "Android 16", assignments: { [caseId]: tester } })).rejects.toMatchObject({ statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a case owner who cannot execute when no explicit tester is chosen", async () => {
    const owner = "507f1f77bcf86cd799439019";
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true, members: [{ user: owner, status: "active" }] });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: planId, workspace: wid, caseIds: [caseId] });
    jest.spyOn(TestCase, "find").mockResolvedValue([{ _id: caseId, key: "TC-014", workspace: wid, owner, currentRevision: 1, state: "active" }]);
    jest.spyOn(TestCaseRevision, "find").mockResolvedValue([{ _id: "revision-1", testCase: caseId, revision: 1, snapshot: { title: "Sign in", steps: [{ action: "Open", expectedResult: "Visible" }] } }]);
    jest.spyOn(PermissionService, "can").mockResolvedValue(false);
    const create = jest.spyOn(TestRun, "create");
    await expect(service.startRun(wid, planId, actor, { build: "1.8.5", environment: "Android 16" })).rejects.toMatchObject({ statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects evidence attached to another workspace", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, workspace: wid, version: 1, snapshot: { steps: [{ action: "Open", expectedResult: "Visible" }] } });
    jest.spyOn(Attachment, "countDocuments").mockResolvedValue(0);
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "fail", reason: "Wrong screen", evidenceIds: [attachmentId], stepResults: [{ result: "fail" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(Attachment.countDocuments).toHaveBeenCalledWith({ _id: { $in: [attachmentId] }, workspace: wid, execution: executionId, uploadedBy: actor, isDeleted: false });
  });

  it("returns a revision conflict without altering a concurrent result", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, workspace: wid, version: 2, snapshot: { steps: [{ action: "Open", expectedResult: "Visible" }] } });
    const update = jest.spyOn(TestExecution, "findOneAndUpdate");
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "pass", stepResults: [{ result: "pass" }] }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(update).not.toHaveBeenCalled();
  });

  it("requires a reason for Fail or Blocked and retains correction history", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, workspace: wid, version: 1, result: "not_run", snapshot: { steps: [{ action: "Open", expectedResult: "Visible" }] } });
    const update = jest.spyOn(TestExecution, "findOneAndUpdate").mockResolvedValue({ version: 2, result: "pass" });
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "fail", stepResults: [{ result: "fail" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    await service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "pass", stepResults: [{ result: "pass" }] });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ workspace: wid, version: 1 }), expect.objectContaining({ $push: expect.objectContaining({ history: expect.objectContaining({ result: "pass", previousResult: "not_run" }) }) }), expect.any(Object));
  });

  it("does not change a closed run or another tester's assignment", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, workspace: wid, run: runId, assignedTo: other, version: 1, result: "not_run", snapshot: { steps: [{ action: "Open", expectedResult: "Visible" }] } });
    jest.spyOn(PermissionService, "can").mockResolvedValue(false);
    const run = jest.spyOn(TestRun, "findOne").mockResolvedValue({ status: "open" });
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "pass", stepResults: [{ result: "pass" }] }))
      .rejects.toMatchObject({ statusCode: 403 });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    run.mockResolvedValue({ status: "closed" });
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "pass", stepResults: [{ result: "pass" }] }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not allow a passing case while a step is still failed or untested", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, workspace: wid, version: 1, result: "not_run", snapshot: { steps: [{ action: "Open", expectedResult: "Visible" }] } });
    const update = jest.spyOn(TestExecution, "findOneAndUpdate");
    await expect(service.recordExecution(wid, executionId, actor, { expectedVersion: 1, result: "pass", stepResults: [{ result: "fail" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(update).not.toHaveBeenCalled();
  });
});
