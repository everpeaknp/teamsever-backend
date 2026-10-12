const List = require("../models/List");
const Task = require("../models/Task");
const PermissionService = require("../permissions/permission.service");
const { listBugs } = require("../services/qaBugQueueService");

jest.mock("../services/qaProjectService", () => ({
  getProjectScope: jest.fn(async () => ({ project: { _id: "507f1f77bcf86cd799439099", scopeType: "workspace", space: null, folder: null }, filter: {} })),
}));

const workspaceId = "507f1f77bcf86cd799439011";
const actorId = "507f1f77bcf86cd799439012";
const allowedList = "507f1f77bcf86cd799439013";
const privateList = "507f1f77bcf86cd799439014";
const space = "507f1f77bcf86cd799439015";

describe("QA bug queue", () => {
  afterEach(() => jest.restoreAllMocks());

  it("only searches lists the member can view", async () => {
    jest.spyOn(List, "find").mockReturnValue({ select: () => ({ lean: async () => [{ _id: allowedList, space }, { _id: privateList, space }] }) });
    jest.spyOn(PermissionService, "can").mockImplementation(async (_actor: string, _action: string, context: any) => context.listId === allowedList);
    const count = jest.spyOn(Task, "countDocuments").mockResolvedValue(0);
    const find = jest.spyOn(Task, "find").mockReturnValue({ select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }) });
    await listBugs(workspaceId, actorId);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ list: { $in: [allowedList] }, workItemType: "bug" }));
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ list: { $in: [allowedList] } }));
    await expect(listBugs(workspaceId, actorId, { listId: privateList })).rejects.toMatchObject({ statusCode: 403 });
  });
});
