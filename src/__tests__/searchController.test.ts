jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = { id: "member-1" };
    next();
  },
}));
jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));
jest.mock("../models/Space", () => ({ find: jest.fn() }));
jest.mock("../models/List", () => ({ find: jest.fn(), distinct: jest.fn() }));
jest.mock("../models/ListMember", () => ({ ListMember: { distinct: jest.fn() } }));
jest.mock("../models/Task", () => ({ find: jest.fn() }));

const express = require("express");
const request = require("supertest");
const Workspace = require("../models/Workspace");
const Space = require("../models/Space");
const List = require("../models/List");
const { ListMember } = require("../models/ListMember");
const Task = require("../models/Task");
const searchRoutes = require("../routes/searchRoutes");

const app = express();
app.use("/api/search", searchRoutes);
app.use((error: any, _req: any, res: any, _next: any) => {
  res.status(error.statusCode || 500).json({ message: error.message });
});

describe("workspace scoped global task search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Workspace.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({
          owner: "owner-1",
          members: [{ user: "member-1", role: "member" }],
        }),
      }),
    });
    Space.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: "space-1", name: "Development" }],
      }),
    });
    ListMember.distinct
      .mockResolvedValueOnce(["list-1"])
      .mockResolvedValueOnce(["space-1"]);
    List.distinct.mockResolvedValue(["list-1"]);
    List.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: "list-1", name: "Bugs", space: "space-1" }],
      }),
    });
    const taskQuery = {
      _id: "task-1",
      title: "Verify menu availability",
      status: "todo",
      list: { _id: "list-1", name: "Bugs" },
      space: { _id: "space-1", name: "Development" },
    };
    const query = {
      populate: () => query,
      sort: () => query,
      limit: () => query,
      lean: async () => [taskQuery],
    };
    Task.find.mockReturnValue(query);
  });

  it("matches tasks by their list and combines all task filters", async () => {
    const response = await request(app).get(
      "/api/search?q=bug&workspaceId=workspace-1&status=todo&assignedToMe=true&createdByMe=true",
    );

    expect(response.status).toBe(200);
    expect(response.body.tasks[0].title).toBe("Verify menu availability");
    expect(response.body.tasks[0].list.name).toBe("Bugs");
    const taskFilter = Task.find.mock.calls[0][0];
    expect(taskFilter).toMatchObject({
      workspace: "workspace-1",
      status: "todo",
      assignee: "member-1",
      createdBy: "member-1",
    });
    expect(taskFilter.$or).toContainEqual({
      list: { $in: ["list-1"] },
    });
    expect(taskFilter.$or).toContainEqual({ description: /bug/i });
  });

  it("rejects a workspace the authenticated user cannot access", async () => {
    Workspace.findOne.mockReturnValue({
      select: () => ({
        lean: async () => ({ owner: "owner-1", members: [] }),
      }),
    });

    const response = await request(app).get(
      "/api/search?q=bug&workspaceId=workspace-1",
    );

    expect(response.status).toBe(403);
    expect(Task.find).not.toHaveBeenCalled();
  });
});
