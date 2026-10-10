jest.mock("../models/Activity", () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock("../services/enhancedNotificationService", () => ({ createNotification: jest.fn().mockResolvedValue({}) }));

const Task = require("../models/Task");
const TestExecution = require("../models/TestExecution");
const PermissionService = require("../permissions/permission.service");
const notifications = require("../services/enhancedNotificationService");
const { transitionBug } = require("../services/bugWorkflowService");

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
      action === "VIEW_TASK" || (actor === qa && action === "VERIFY_BUG"));
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
    const result = await transitionBug(bugId, "verify", qa, { idempotencyKey: "verify-3", reason: "Passed on build 1.8.5" });
    expect(result.status).toBe("done");
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
