jest.mock("../permissions/permission.middleware", () => ({
  requirePermission: jest.fn((action: string) => (_req: any, _res: any, next: any) => next()),
}));
jest.mock("../middlewares/subscriptionMiddleware", () => ({
  checkTaskLimit: jest.fn((_req: any, _res: any, next: any) => next()),
}));

const { requirePermission } = require("../permissions/permission.middleware");
const { checkTaskLimit } = require("../middlewares/subscriptionMiddleware");
const { authorizeTaskCreation } = require("../middlewares/taskCreationGuard");

describe("task and bug creation gates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("checks a bug reporter's list view and bug grant without consuming a task slot", async () => {
    const next = jest.fn();
    await authorizeTaskCreation({ body: { workItemType: "bug" } }, {}, next);
    expect(requirePermission).toHaveBeenCalledWith("VIEW_LIST");
    expect(requirePermission).toHaveBeenCalledWith("CREATE_BUG");
    expect(checkTaskLimit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("keeps the ordinary task quota and permission path", async () => {
    const next = jest.fn();
    await authorizeTaskCreation({ body: { title: "Work" } }, {}, next);
    expect(checkTaskLimit).toHaveBeenCalledTimes(1);
    expect(requirePermission).toHaveBeenCalledWith("CREATE_TASK");
    expect(requirePermission).not.toHaveBeenCalledWith("CREATE_BUG");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("stops if list scope denies the bug reporter", async () => {
    requirePermission.mockImplementation((action: string) => (_req: any, _res: any, next: any) => {
      next(action === "VIEW_LIST" ? new Error("Forbidden") : undefined);
    });
    const next = jest.fn();
    await authorizeTaskCreation({ body: { workItemType: "bug" } }, {}, next);
    expect(requirePermission).not.toHaveBeenCalledWith("CREATE_BUG");
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
