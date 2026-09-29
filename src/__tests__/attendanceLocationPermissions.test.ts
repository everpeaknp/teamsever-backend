jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/CustomRole", () => ({ findById: jest.fn() }));

const Workspace = require("../models/Workspace");
const CustomRole = require("../models/CustomRole");
const PermissionService = require("../permissions/permission.service");

describe("MANAGE_ATTENDANCE_LOCATIONS effective workspace authorization", () => {
  const ownerId = "owner-user";
  const memberId = "manager-user";
  const workspaceId = "workspace-a";
  let workspace: any;

  const setWorkspace = (value: any) => {
    workspace = value;
    Workspace.findById.mockImplementation(() => ({ select: () => Promise.resolve(workspace) }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    CustomRole.findById.mockResolvedValue(null);
    setWorkspace({
      owner: { toString: () => ownerId },
      members: [{ user: { toString: () => memberId }, role: "member", additionalPermissions: [], restrictedPermissions: [] }],
      rolePermissionAdditions: []
    });
  });

  const canManage = (userId = memberId, wsId = workspaceId) => PermissionService.can(userId, "MANAGE_ATTENDANCE_LOCATIONS", { userId, workspaceId: wsId });

  it("grants a delegated individual permission", async () => {
    workspace.members[0].additionalPermissions = ["MANAGE_ATTENDANCE_LOCATIONS"];
    expect(await canManage()).toBe(true);
  });

  it("honors explicit member restrictions over role and individual grants", async () => {
    workspace.members[0].role = "admin";
    workspace.members[0].additionalPermissions = ["MANAGE_ATTENDANCE_LOCATIONS"];
    workspace.members[0].restrictedPermissions = ["MANAGE_ATTENDANCE_LOCATIONS"];
    expect(await canManage()).toBe(false);
  });

  it("grants a permission delegated to a system role", async () => {
    workspace.members[0].role = "operations_manager";
    workspace.rolePermissionAdditions = [{ role: "operations_manager", permissions: ["MANAGE_ATTENDANCE_LOCATIONS"] }];
    expect(await canManage()).toBe(true);
  });

  it("grants a permission in a custom role", async () => {
    workspace.members[0].customRole = "custom-role-id";
    CustomRole.findById.mockResolvedValue({ permissions: ["MANAGE_ATTENDANCE_LOCATIONS"] });
    expect(await canManage()).toBe(true);
  });

  it("does not carry a grant into another workspace", async () => {
    setWorkspace({ owner: { toString: () => ownerId }, members: [], rolePermissionAdditions: [] });
    expect(await canManage(memberId, "workspace-b")).toBe(false);
  });
});
