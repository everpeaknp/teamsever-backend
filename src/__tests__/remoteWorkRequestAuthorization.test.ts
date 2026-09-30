jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../models/LeaveRequest", () => ({ find: jest.fn() }));
jest.mock("../permissions/permission.service", () => ({ can: jest.fn() }));

const Workspace = require("../models/Workspace");
const LeaveRequest = require("../models/LeaveRequest");
const PermissionService = require("../permissions/permission.service");
const LeaveService = require("../services/leaveService");

describe("private remote request review scope", () => {
  const workspaceId = "workspace-1";
  const ownerId = "owner-1";
  const assignedManagerId = "manager-1";
  const otherManagerId = "manager-2";
  let findQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Workspace.findById.mockReturnValue({ select: () => Promise.resolve({ _id: workspaceId, owner: ownerId }) });
    findQuery = { populate: jest.fn(function () { return this; }), sort: jest.fn().mockResolvedValue([{ _id: "remote-1", proposedRemoteArea: { latitude: 27.7, longitude: 85.3 } }]) };
    LeaveRequest.find.mockReturnValue(findQuery);
    PermissionService.can.mockResolvedValue(true);
  });

  it("only fetches the assigned manager's own pending remote requests", async () => {
    await LeaveService.getRemoteRequests(workspaceId, assignedManagerId);
    expect(LeaveRequest.find).toHaveBeenCalledWith({ workspace: workspaceId, requestType: "remote", status: "pending", assignedManager: assignedManagerId });
  });

  it("allows the owner to see pending remote requests for override", async () => {
    await LeaveService.getRemoteRequests(workspaceId, ownerId);
    expect(LeaveRequest.find).toHaveBeenCalledWith({ workspace: workspaceId, requestType: "remote", status: "pending" });
  });

  it("does not expose any remote requests to an unassigned manager without request permission", async () => {
    PermissionService.can.mockResolvedValue(false);
    await expect(LeaveService.getRemoteRequests(workspaceId, otherManagerId)).rejects.toThrow("permission to review remote requests");
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });

  it("allows only the assigned approver or the workspace owner to decide", async () => {
    Workspace.findById.mockReturnValue({ select: () => Promise.resolve({ owner: ownerId }) });
    const leave = { assignedManager: { _id: assignedManagerId } };
    await expect((LeaveService as any).assertCanDecideLeave(leave, otherManagerId, workspaceId)).rejects.toThrow("Only the assigned approver or workspace owner");
    await expect((LeaveService as any).assertCanDecideLeave(leave, assignedManagerId, workspaceId)).resolves.toBeUndefined();
    await expect((LeaveService as any).assertCanDecideLeave(leave, ownerId, workspaceId)).resolves.toBeUndefined();
  });
});
