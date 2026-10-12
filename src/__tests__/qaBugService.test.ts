jest.mock("../models/Activity", () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock("../socket/events", () => ({ emitSpaceEvent: jest.fn(), emitTaskEvent: jest.fn() }));
jest.mock("../services/enhancedNotificationService", () => ({
  notifyTaskUpdate: jest.fn().mockResolvedValue(undefined),
  createNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../services/analyticsV2CacheService", () => ({ invalidateWorkspace: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../utils/logger", () => ({ logActivity: jest.fn().mockResolvedValue(undefined) }));

const List = require("../models/List");
const Space = require("../models/Space");
const Workspace = require("../models/Workspace");
const Task = require("../models/Task");
const service = require("../services/taskService");

const wid = "507f1f77bcf86cd799439011";
const sid = "507f1f77bcf86cd799439012";
const lid = "507f1f77bcf86cd799439013";
const reporter = "507f1f77bcf86cd799439014";
const assignee = "507f1f77bcf86cd799439015";

const bugInput = {
  title: "Google sign-in fails",
  list: lid,
  createdBy: reporter,
  assignee,
  workItemType: "bug",
  bugDetails: {
    reproductionSteps: "Choose Google on Login",
    expectedResult: "Dashboard opens",
    actualResult: "Returns to Login",
    severity: "high",
    environment: "Android 16",
  },
};

describe("creating a workspace bug", () => {
  let listLookup: jest.SpyInstance;
  let spaceLookup: jest.SpyInstance;
  let workspaceLookup: jest.SpyInstance;
  let taskCount: jest.SpyInstance;
  let taskCreate: jest.SpyInstance;

  beforeEach(() => {
    listLookup = jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, name: "Backlog", workspace: wid, space: sid });
    spaceLookup = jest.spyOn(Space, "findOne").mockResolvedValue({ _id: sid, name: "Product", workspace: wid });
    workspaceLookup = jest.spyOn(Workspace, "findOne").mockResolvedValue({
      _id: wid,
      owner: reporter,
      qualityEnabled: true,
      members: [
        { user: reporter, role: "qa", status: "active" },
        { user: assignee, role: "developer", status: "active" },
      ],
    });
    taskCount = jest.spyOn(Task, "countDocuments").mockResolvedValue(0);
    taskCreate = jest.spyOn(Task, "create").mockImplementation(async (data: any) => ({ _id: lid, ...data }));
  });

  afterEach(() => jest.restoreAllMocks());

  it("persists bug fields and targets its assignment notification", async () => {
    const created = await service.createTask(bugInput);
    expect(created.workItemType).toBe("bug");
    expect(created.bugDetails.actualResult).toBe("Returns to Login");
    expect(taskCreate).toHaveBeenCalledWith(expect.objectContaining({
      workItemType: "bug",
      workspace: wid,
      list: lid,
      assignee,
    }));
    const notification = require("../services/enhancedNotificationService");
    expect(notification.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: assignee,
      type: "TASK_ASSIGNED",
      title: "Bug assigned",
      data: expect.objectContaining({ taskId: lid, workspaceId: wid }),
    }));
    expect(notification.notifyTaskUpdate).not.toHaveBeenCalled();
  });

  it("does not let a bug be assigned to someone outside the workspace", async () => {
    await expect(service.createTask({ ...bugInput, assignee: "507f1f77bcf86cd799439099" })).rejects.toMatchObject({ statusCode: 400 });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("stores only an active workspace member as QA reviewer", async () => {
    await expect(service.createTask({ ...bugInput, qaReviewer: "507f1f77bcf86cd799439099" }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(taskCreate).not.toHaveBeenCalled();
    const created = await service.createTask({ ...bugInput, qaReviewer: reporter });
    expect(created.qaReviewer).toBe(reporter);
  });

  it("limits repeated bug submissions by one reporter", async () => {
    taskCount.mockResolvedValue(30);
    await expect(service.createTask(bugInput)).rejects.toMatchObject({ statusCode: 429 });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("rejects a bug when Quality is disabled in the workspace", async () => {
    workspaceLookup.mockResolvedValue({ _id: wid, owner: reporter, qualityEnabled: false, members: [{ user: reporter, status: "active" }] });
    await expect(service.createTask({ ...bugInput, assignee: undefined })).rejects.toMatchObject({ statusCode: 403 });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("does not allow a bug to start as Verified or Ready for QA", async () => {
    await expect(service.createTask({ ...bugInput, status: "done" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createTask({ ...bugInput, status: "review" })).rejects.toMatchObject({ statusCode: 400 });
    expect(taskCreate).not.toHaveBeenCalled();
  });
});
