const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const QaModule = require("../models/QaModule");
const qaProjectService = require("../services/qaProjectService");
const service = require("../services/qaModuleService");

const wid = "507f1f77bcf86cd799439011";
const sid = "507f1f77bcf86cd799439012";
const uid = "507f1f77bcf86cd799439013";
const pid = "507f1f77bcf86cd799439014";

describe("QA project modules", () => {
  let workspaceLookup: jest.SpyInstance;
  let spaceLookup: jest.SpyInstance;
  let moduleCreate: jest.SpyInstance;
  let projectScope: jest.SpyInstance;

  beforeEach(() => {
    workspaceLookup = jest.spyOn(Workspace, "findOne").mockResolvedValue({ _id: wid, qualityEnabled: true });
    spaceLookup = jest.spyOn(Space, "findOne").mockResolvedValue({ _id: sid, workspace: wid });
    moduleCreate = jest.spyOn(QaModule, "create").mockImplementation(async (data: any) => data);
    projectScope = jest.spyOn(qaProjectService, "getProjectScope").mockResolvedValue({
      project: { _id: pid, scopeType: "folder", space: sid },
      filter: { project: pid },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("creates a module inside the selected QA project", async () => {
    const created = await service.createModule(wid, uid, { name: "Authentication", space: sid, projectId: pid });
    expect(created).toMatchObject({ workspace: wid, project: pid, name: "Authentication", space: sid, createdBy: uid });
    expect(projectScope).toHaveBeenCalledWith(wid, pid, uid);
    expect(spaceLookup).toHaveBeenCalledWith({ _id: sid, workspace: wid, isDeleted: false });
  });

  it("rejects an unrelated space", async () => {
    spaceLookup.mockResolvedValue(null);
    await expect(service.createModule(wid, uid, { name: "Authentication", space: sid })).rejects.toMatchObject({ statusCode: 400 });
    expect(moduleCreate).not.toHaveBeenCalled();
  });

  it("requires Quality to be enabled", async () => {
    workspaceLookup.mockResolvedValue({ _id: wid, qualityEnabled: false });
    await expect(service.createModule(wid, uid, { name: "Authentication" })).rejects.toMatchObject({ statusCode: 403 });
    expect(moduleCreate).not.toHaveBeenCalled();
  });

  it("paginates only active modules in the requested workspace", async () => {
    const query: any = {
      sort: jest.fn(() => query),
      skip: jest.fn(() => query),
      limit: jest.fn(() => query),
      lean: jest.fn().mockResolvedValue([{ name: "Login" }]),
    };
    const find = jest.spyOn(QaModule, "find").mockReturnValue(query);
    const count = jest.spyOn(QaModule, "countDocuments").mockResolvedValue(3);
    const result = await service.listModules(wid, 2, 2, pid);
    expect(find).toHaveBeenCalledWith({ workspace: wid, project: pid, isArchived: false });
    expect(query.skip).toHaveBeenCalledWith(2);
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(count).toHaveBeenCalledWith({ workspace: wid, project: pid, isArchived: false });
    expect(result).toEqual({ data: [{ name: "Login" }], pagination: { page: 2, limit: 2, total: 3 } });
  });

  it("switches the workspace flag only with a boolean value", async () => {
    const update = jest.spyOn(Workspace, "findOneAndUpdate").mockResolvedValue({ _id: wid, qualityEnabled: true });
    await expect(service.setQualityEnabled(wid, "yes")).rejects.toMatchObject({ statusCode: 400 });
    const result = await service.setQualityEnabled(wid, true);
    expect(update).toHaveBeenCalledWith(
      { _id: wid, isDeleted: false },
      { $set: { qualityEnabled: true } },
      { new: true, projection: "qualityEnabled" },
    );
    expect(result.qualityEnabled).toBe(true);
  });

  it("archives a module only by workspace-scoped ID", async () => {
    const update = jest.spyOn(QaModule, "findOneAndUpdate").mockResolvedValue({ _id: sid, isArchived: true });
    const result = await service.archiveModule(wid, sid, pid, uid);
    expect(update).toHaveBeenCalledWith(
      { _id: sid, workspace: wid, project: pid, isArchived: false },
      { $set: { isArchived: true } },
      { new: true },
    );
    expect(result.isArchived).toBe(true);
  });

  it("explains when the legacy workspace-wide index is blocking a project module", async () => {
    moduleCreate.mockRejectedValue(Object.assign(new Error("duplicate"), {
      code: 11000,
      keyPattern: { workspace: 1, name: 1 },
    }));

    await expect(service.createModule(wid, uid, { name: "Authentication", space: sid, projectId: pid }))
      .rejects.toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("npm run migrate:qa-projects"),
      });
  });
});
