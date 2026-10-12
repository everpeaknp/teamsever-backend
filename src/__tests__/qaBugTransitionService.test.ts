jest.mock("../models/Activity", () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock("../services/enhancedNotificationService", () => ({ createNotification: jest.fn().mockResolvedValue({}) }));

const Task = require("../models/Task");
const TestExecution = require("../models/TestExecution");
const PermissionService = require("../permissions/permission.service");
const notifications = require("../services/enhancedNotificationService");
const { transitionBug, listVerificationRetests, linkPassingRetest } = require("../services/bugWorkflowService");

const bugId = "507f1f77bcf86cd799439011";
const workspaceId = "507f1f77bcf86cd799439012";
const developer = "507f1f77bcf86cd799439013";
const qa = "507f1f77bcf86cd799439014";

const makeBug = (status = "inprogress") => ({
  _id: bugId,
  title: "Google sign-in fails",
  workItemType: "bug",
  status,
  workspace: workspaceId,
  space: "507f1f77bcf86cd799439015",
  list: "507f1f77bcf86cd799439016",
  assignee: developer,
  createdBy: qa,
  qaReviewer: qa,
  qualityTransitionKeys: [] as string[],
  bugHistory: [] as any[],
});

describe("server-authoritative bug transition", () => {
  let bug: ReturnType<typeof makeBug>;
  let find: jest.SpyInstance;
  let update: jest.SpyInstance;
  let permission: jest.SpyInstance;

  beforeEach(() => {
    bug = makeBug();
    find = jest.spyOn(Task, "findOne").mockImplementation(async () => bug);
    update = jest.spyOn(Task, "findOneAndUpdate").mockImplementation(async (filter: any, change: any) => {
      if (filter.status !== bug.status) return null;
      bug.status = change.$set.status;
      bug.qualityTransitionKeys.push(...change.$push.qualityTransitionKeys.$each);
      bug.bugHistory.push(...change.$push.bugHistory.$each);
      return { ...bug };
    });
    permission = jest.spyOn(PermissionService, "can").mockImplementation(async (actor: string, action: string) =>
      action === "VIEW_TASK" || (actor === qa && action === "QA_VERIFY_BUG"));
    jest.clearAllMocks();
  });

  afterEach(() => jest.restoreAllMocks());

  it("moves an assigned developer's fix to QA and notifies only its reviewer", async () => {
    const result = await transitionBug(bugId, "ready_for_qa", developer, { idempotencyKey: "ready-1" });
    expect(result.status).toBe("review");
    expect(bug.bugHistory[0]).toMatchObject({ action: "ready_for_qa", from: "inprogress", to: "review", actor: developer });
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: qa,
      title: "Bug ready for QA",
      data: expect.objectContaining({ taskId: bugId, workspaceId }),
    }));
  });

  it("requires a QA grant and retest note to verify a fix", async () => {
    bug.status = "review";
    await expect(transitionBug(bugId, "verify", developer, { idempotencyKey: "verify-1", reason: "Passed" }))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-2" }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-3", reason: "Passed on build 1.8.5" }))
      .rejects.toMatchObject({ statusCode: 400, message: "A linked passing retest is required to verify" });
  });

  it("prevents the assigned fixer from verifying even when they have verifier permission", async () => {
    permission.mockResolvedValue(true);
    bug.status = "review";
    const executionId = "507f1f77bcf86cd799439099";
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, result: "pass", bugIds: [bugId] });

    await expect(transitionBug(bugId, "verify", developer, {
      idempotencyKey: "self-verify", reason: "Retest passed", executionId,
    })).rejects.toMatchObject({ statusCode: 403, message: "The person who handled the fix cannot verify it" });
  });

  it("prevents the person who handed the fix to QA from verifying after reassignment", async () => {
    permission.mockResolvedValue(true);
    bug.status = "review";
    bug.assignee = qa;
    bug.bugHistory.push({ action: "ready_for_qa", actor: developer });
    const executionId = "507f1f77bcf86cd799439099";
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, result: "pass", bugIds: [bugId] });

    await expect(transitionBug(bugId, "verify", developer, {
      idempotencyKey: "fixer-reassigned", reason: "Retest passed", executionId,
    })).rejects.toMatchObject({ statusCode: 403, message: "The person who handled the fix cannot verify it" });
  });

  it("blocks verification of an unassigned bug when no fix owner is recorded", async () => {
    permission.mockResolvedValue(true);
    bug.status = "review";
    (bug as any).assignee = undefined;
    const executionId = "507f1f77bcf86cd799439099";
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, result: "pass", bugIds: [bugId] });

    await expect(transitionBug(bugId, "verify", qa, {
      idempotencyKey: "unknown-fixer", reason: "Retest passed", executionId,
    })).rejects.toMatchObject({ statusCode: 409, message: "Record who handled the fix before verifying this bug" });
  });

  it("prevents the person who started the fix from verifying after another person submits it to QA", async () => {
    permission.mockResolvedValue(true);
    bug.status = "review";
    bug.assignee = qa;
    bug.bugHistory.push({ action: "start", actor: developer }, { action: "ready_for_qa", actor: qa });
    const executionId = "507f1f77bcf86cd799439099";
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: executionId, result: "pass", bugIds: [bugId] });

    await expect(transitionBug(bugId, "verify", developer, {
      idempotencyKey: "starter-cannot-verify", reason: "Retest passed", executionId,
    })).rejects.toMatchObject({ statusCode: 403, message: "The person who handled the fix cannot verify it" });
  });

  it("lists linked and linkable passing retests and reports whether this user handled the fix", async () => {
    bug.bugHistory.push({ action: "ready_for_qa", actor: developer });
    const retests = [{ _id: "retest-1", caseKey: "TC-001", result: "pass" }];
    const query = {
      select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(retests),
    };
    const lookup = jest.spyOn(TestExecution, "find").mockReturnValue(query as any);

    const result = await listVerificationRetests(bugId, qa);

    expect(lookup).toHaveBeenCalledWith({ workspace: workspaceId, bugIds: bugId, result: "pass" });
    expect(result).toMatchObject({ retests, availableRetests: retests, canVerify: true });
  });

  it("reopening requires a reason and notifies the developer", async () => {
    bug.status = "review";
    await expect(transitionBug(bugId, "reopen", qa, { idempotencyKey: "reopen-1" }))
      .rejects.toMatchObject({ statusCode: 400 });
    const result = await transitionBug(bugId, "reopen", qa, { idempotencyKey: "reopen-2", reason: "Still fails on Android" });
    expect(result.status).toBe("todo");
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ recipientId: developer, title: "Bug reopened" }));
  });

  it("accepts only a linked passing retest to verify a bug", async () => {
    bug.status = "review";
    const executionId = "507f1f77bcf86cd799439099";
    const lookup = jest.spyOn(TestExecution, "findOne").mockResolvedValue(null);
    await expect(transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-ex-1", reason: "Passed", executionId }))
      .rejects.toMatchObject({ statusCode: 400 });
    lookup.mockResolvedValue({ _id: executionId, result: "fail", bugIds: [bugId] });
    await expect(transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-ex-2", reason: "Passed", executionId }))
      .rejects.toMatchObject({ statusCode: 409 });
    lookup.mockResolvedValue({ _id: executionId, result: "pass", bugIds: [bugId] });
    bug.assignee = "507f1f77bcf86cd799439099";
    await transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-ex-3", reason: "Passed", executionId });
    expect(lookup).toHaveBeenCalledWith({ _id: executionId, workspace: workspaceId, bugIds: bugId });
    expect(bug.status).toBe("done");
  });

  it("repeated delivery of the same key does not produce another event or notification", async () => {
    await transitionBug(bugId, "ready_for_qa", developer, { idempotencyKey: "ready-repeat" });
    await transitionBug(bugId, "ready_for_qa", developer, { idempotencyKey: "ready-repeat" });
    expect(update).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });

  it("does not reveal an earlier idempotent response after access is revoked", async () => {
    bug.qualityTransitionKeys.push("known-key");
    permission.mockResolvedValue(false);
    await expect(transitionBug(bugId, "ready_for_qa", developer, { idempotencyKey: "known-key" }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the notification within the saved notification body limit", async () => {
    bug.status = "review";
    await transitionBug(bugId, "reopen", qa, { idempotencyKey: "reopen-long", reason: "x".repeat(1500) });
    const sent = notifications.createNotification.mock.calls[0][0];
    expect(sent.body.length).toBeLessThanOrEqual(1000);
    expect(bug.bugHistory[0].reason.length).toBe(1500);
  });
});

describe("linking passing retests from a bug", () => {
  afterEach(() => jest.restoreAllMocks());

  it("links a passing execution from the same QA project to the bug", async () => {
    jest.spyOn(Task, "findOne").mockResolvedValue({ ...makeBug("review"), qaProject: "507f1f77bcf86cd799439018", qaSourceCaseKey: "TC-002" });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(TestExecution, "findOne").mockResolvedValue({ _id: "507f1f77bcf86cd799439099", result: "pass" });
    const update = jest.spyOn(TestExecution, "updateOne").mockResolvedValue({ modifiedCount: 1 });

    await linkPassingRetest(bugId, "507f1f77bcf86cd799439099", qa);

    expect(update).toHaveBeenCalledWith(
      { _id: "507f1f77bcf86cd799439099", workspace: workspaceId, project: "507f1f77bcf86cd799439018", result: "pass" },
      { $addToSet: { bugIds: bugId } },
    );
  });

  it("refuses to link an execution that is not passing", async () => {
    jest.spyOn(Task, "findOne").mockResolvedValue({ ...makeBug("review"), qaProject: "507f1f77bcf86cd799439018" });
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);
    jest.spyOn(TestExecution, "findOne").mockResolvedValue(null);
    const update = jest.spyOn(TestExecution, "updateOne");

    await expect(linkPassingRetest(bugId, "507f1f77bcf86cd799439099", qa)).rejects.toMatchObject({ statusCode: 404 });
    expect(update).not.toHaveBeenCalled();
  });
});
