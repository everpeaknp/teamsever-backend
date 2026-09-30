const express = require("express");
const request = require("supertest");

const mockWorkspaceId = "64b000000000000000000001";
const mockOwnerId = "owner-user";
const mockMemberId = "member-user";
const mockManagerId = "manager-user";

jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = { id: req.header("x-test-user") || mockMemberId };
    next();
  },
}));
jest.mock("../middlewares/desktopDeviceAuth", () => ({ desktopDeviceAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../permissions/permission.service", () => ({
  can: jest.fn(async (userId: string, _permission: string, context: any) => userId === mockManagerId && context?.workspaceId === mockWorkspaceId),
}));
jest.mock("../models/Workspace", () => ({ findById: jest.fn() }));
jest.mock("../controllers/attendanceLocationController", () => new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ success: true }) }));

const Workspace = require("../models/Workspace");
const router = require("../routes/attendanceLocationRoutes");

function makeWorkspace(overrides: any = {}) {
  return {
    _id: mockWorkspaceId,
    owner: mockOwnerId,
    members: [
      { user: mockOwnerId, role: "owner", status: "active" },
      { user: mockMemberId, role: "member", status: "active" },
      { user: mockManagerId, role: "admin", status: "active" },
    ],
    desktopPresencePolicy: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let workspace: any;
let app: any;

beforeEach(() => {
  jest.clearAllMocks();
  workspace = makeWorkspace();
  Workspace.findById.mockImplementation(async (id: string) => id === mockWorkspaceId ? workspace : null);
  app = express();
  app.use(express.json());
  app.use("/api/attendance", router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));
});

describe("desktop presence workspace policy", () => {
  const policyUrl = `/api/attendance/workspace/${mockWorkspaceId}/desktop-presence-policy`;

  it("returns the default five-minute threshold to an active workspace member", async () => {
    const response = await request(app).get(policyUrl).set("x-test-user", mockMemberId);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ policy: { afkThresholdMinutes: 5 }, canManage: false });
  });

  it.each([1, 60])("accepts %i minutes for an authorized manager", async (afkThresholdMinutes) => {
    const response = await request(app).put(policyUrl).set("x-test-user", mockManagerId).send({ afkThresholdMinutes });
    expect(response.status).toBe(200);
    expect(workspace.desktopPresencePolicy.afkThresholdMinutes).toBe(afkThresholdMinutes);
    expect(workspace.save).toHaveBeenCalledTimes(1);
  });

  it.each([0, 61, 1.5, "5", null])("rejects invalid threshold %p without saving", async (afkThresholdMinutes) => {
    const response = await request(app).put(policyUrl).set("x-test-user", mockManagerId).send({ afkThresholdMinutes });
    expect(response.status).toBe(400);
    expect(workspace.save).not.toHaveBeenCalled();
    expect(workspace.desktopPresencePolicy).toBeUndefined();
  });

  it("allows the workspace owner to update the policy", async () => {
    const response = await request(app).put(policyUrl).set("x-test-user", mockOwnerId).send({ afkThresholdMinutes: 7 });
    expect(response.status).toBe(200);
    expect(workspace.desktopPresencePolicy.afkThresholdMinutes).toBe(7);
  });

  it("rejects updates by a regular member", async () => {
    const response = await request(app).put(policyUrl).set("x-test-user", mockMemberId).send({ afkThresholdMinutes: 7 });
    expect(response.status).toBe(403);
    expect(workspace.save).not.toHaveBeenCalled();
  });

  it("rejects inactive or non-member reads", async () => {
    workspace.members = workspace.members.filter((item: any) => item.user !== mockMemberId);
    const response = await request(app).get(policyUrl).set("x-test-user", mockMemberId);
    expect(response.status).toBe(403);
  });

  it("rejects malformed workspace IDs before lookup", async () => {
    const response = await request(app).get("/api/attendance/workspace/not-an-id/desktop-presence-policy").set("x-test-user", mockOwnerId);
    expect(response.status).toBe(400);
    expect(Workspace.findById).not.toHaveBeenCalled();
  });
});
