const Task = require("../models/Task");
const { createTaskSchema } = require("../validators/taskValidators");
const Workspace = require("../models/Workspace");
const QaModule = require("../models/QaModule");
const { roleHasPermission } = require("../permissions/permission.constants");
const permissionConstants = require("../permissions/permission.constants");
const { WorkspaceRole } = require("../permissions/permission.types");
const { getPermissionCatalog } = require("../controllers/customRoleController");

const oid = "507f1f77bcf86cd799439011";

const makeTask = (overrides: Record<string, unknown> = {}) =>
  new Task({
    title: "Sign-in fails",
    list: oid,
    space: oid,
    workspace: oid,
    createdBy: oid,
    ...overrides,
  });

describe("QA bug foundation", () => {
  it("keeps existing task creation compatible with a task type default", async () => {
    const task = makeTask();
    await expect(task.validate()).resolves.toBeUndefined();
    expect(task.workItemType).toBe("task");
  });

  it("requires reproduction, expected, actual, severity, and environment for bugs", async () => {
    const bug = makeTask({ workItemType: "bug" });
    let error: any;
    try { await bug.validate(); } catch (validationError) { error = validationError; }
    expect(error).toBeDefined();
    for (const field of ["reproductionSteps", "expectedResult", "actualResult", "severity", "environment"]) {
      expect(error.errors[`bugDetails.${field}`]).toBeDefined();
    }
  });

  it("accepts a complete bug without changing the ordinary task status", async () => {
    const bug = makeTask({
      workItemType: "bug",
      bugDetails: {
        reproductionSteps: "Open Login; select Google; choose an existing account",
        expectedResult: "Dashboard opens",
        actualResult: "Login returns to the form",
        severity: "high",
        environment: "Android 16, build 1.8.4",
      },
    });
    await expect(bug.validate()).resolves.toBeUndefined();
    expect(bug.status).toBe("todo");
  });

  it("keeps a reviewer and embedded transition audit on the bug record", async () => {
    const bug = makeTask({
      workItemType: "bug",
      qaReviewer: oid,
      bugDetails: {
        reproductionSteps: "Open Login",
        expectedResult: "Dashboard",
        actualResult: "Error",
        severity: "high",
        environment: "Android 16",
      },
      qualityTransitionKeys: ["request-1"],
      bugHistory: [{ action: "ready_for_qa", from: "inprogress", to: "review", actor: oid, at: new Date() }],
    });
    await expect(bug.validate()).resolves.toBeUndefined();
    expect(bug.qaReviewer.toString()).toBe(oid);
    expect(bug.bugHistory[0].action).toBe("ready_for_qa");
  });

  it("rejects an incomplete bug at the API boundary", () => {
    const parsed = createTaskSchema.safeParse({
      params: { listId: oid },
      body: { title: "Sign-in fails", workItemType: "bug" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects bug-only fields on an ordinary task", () => {
    const parsed = createTaskSchema.safeParse({
      params: { listId: oid },
      body: {
        title: "Sign-in work",
        workItemType: "task",
        bugDetails: { severity: "critical" },
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("grants the QA role every Quality workflow permission", () => {
    for (const permission of [
      "QA_VIEW",
      "QA_MANAGE_CASES",
      "QA_EXECUTE",
      "QA_CREATE_BUG",
      "QA_TRIAGE_BUG",
      "QA_VERIFY_BUG",
      "QA_MANAGE_RELEASES",
      "QA_SIGN_OFF",
    ] as const) {
      expect(roleHasPermission(WorkspaceRole.QA, permission)).toBe(true);
    }
  });

  it("removes newly inherited QA permissions from legacy member additions", () => {
    expect(permissionConstants.withoutInheritedRolePermissions?.(
      WorkspaceRole.QA,
      ["QA_SIGN_OFF", "QA_TRIAGE_BUG", "MANAGE_SETTINGS"],
    )).toEqual(["MANAGE_SETTINGS"]);
  });

  it("keeps the new Quality UI gated for existing workspaces", () => {
    const workspace = new Workspace({ name: "Example", owner: oid });
    expect(workspace.qualityEnabled).toBe(false);
  });

  it("requires a workspace and name for a QA module", async () => {
    const missingWorkspace = new QaModule({ name: "Login", createdBy: oid });
    await expect(missingWorkspace.validate()).rejects.toThrow();
    const valid = new QaModule({ workspace: oid, name: "Login", createdBy: oid });
    await expect(valid.validate()).resolves.toBeUndefined();
    expect(valid.isArchived).toBe(false);
  });

  it("lets custom roles select every Quality permission", async () => {
    let payload: any;
    await getPermissionCatalog({}, {
      status: () => ({ json: (value: any) => { payload = value; } }),
    });
    const keys = payload.data.map((entry: any) => entry.key);
    for (const key of ["QA_VIEW", "QA_MANAGE_CASES", "QA_EXECUTE", "QA_MANAGE_RELEASES", "QA_CREATE_BUG", "QA_TRIAGE_BUG", "QA_VERIFY_BUG", "QA_SIGN_OFF"]) {
      expect(keys).toContain(key);
    }
  });
});
