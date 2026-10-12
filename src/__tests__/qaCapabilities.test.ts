const Workspace = require("../models/Workspace");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const { getCapabilities } = require("../services/qaCapabilityService");

jest.mock("../services/qaProjectService", () => ({
  getProjectScope: jest.fn(async () => ({ project: { _id: "507f1f77bcf86cd799439099", scopeType: "workspace", space: null, folder: null }, filter: {} })),
}));

const wid = "507f1f77bcf86cd799439011";
const lid = "507f1f77bcf86cd799439012";
const uid = "507f1f77bcf86cd799439013";
const sid = "507f1f77bcf86cd799439014";

describe("QA capabilities", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns feature-gated permissions for an accessible list", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, space: sid });
    jest.spyOn(PermissionService, "can").mockImplementation(async (_id: string, action: string) => action !== "QA_TRIAGE_BUG");
    const result = await getCapabilities(wid, uid, lid);
    expect(result).toMatchObject({ qualityEnabled: true, canViewQuality: true, canCreateBug: true, canTriageBug: false });
    expect(List.findOne).toHaveBeenCalledWith({ _id: lid, workspace: wid, isDeleted: false });
  });

  it("does not grant a bug entry point without list access", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(List, "findOne").mockResolvedValue({ _id: lid, space: sid });
    jest.spyOn(PermissionService, "can").mockImplementation(async (_id: string, action: string) => action !== "VIEW_LIST");
    const result = await getCapabilities(wid, uid, lid);
    expect(result.canCreateBug).toBe(false);
  });

  it("does not reveal a list in another workspace", async () => {
    jest.spyOn(Workspace, "findOne").mockResolvedValue({ qualityEnabled: true });
    jest.spyOn(List, "findOne").mockResolvedValue(null);
    await expect(getCapabilities(wid, uid, lid)).rejects.toMatchObject({ statusCode: 404 });
  });
});
