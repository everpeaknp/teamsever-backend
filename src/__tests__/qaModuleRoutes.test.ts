jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => { req.user = { id: req.headers["x-test-user"] || "qa-user" }; next(); },
}));
jest.mock("../permissions/permission.middleware", () => ({
  requirePermission: (action: string) => (req: any, res: any, next: any) => {
    if (req.user.id === "viewer" && action !== "VIEW_QUALITY") {
      return res.status(403).json({ success: false });
    }
    next();
  },
}));
jest.mock("../services/qaModuleService", () => ({
  listModules: jest.fn().mockResolvedValue({ data: [{ name: "Login" }], pagination: { page: 1, limit: 30, total: 1 } }),
  createModule: jest.fn().mockImplementation(async (workspace: string, actor: string, input: any) => ({ workspace, createdBy: actor, ...input })),
  archiveModule: jest.fn(),
  setQualityEnabled: jest.fn(),
}));
jest.mock("../models/Workspace", () => ({ findOne: jest.fn() }));

const express = require("express");
const request = require("supertest");
const qaModuleRoutes = require("../routes/qaModuleRoutes");
const service = require("../services/qaModuleService");

const app = express();
app.use(express.json());
app.use("/api/workspaces/:workspaceId/quality", qaModuleRoutes);

describe("QA module routes", () => {
  it("returns only the requested workspace's paginated modules", async () => {
    const response = await request(app).get("/api/workspaces/w1/quality/modules?page=1&limit=30");
    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(1);
    expect(service.listModules).toHaveBeenCalledWith("w1", 1, 30);
  });

  it("creates with authenticated actor and path workspace", async () => {
    const response = await request(app).post("/api/workspaces/w1/quality/modules").send({ name: "Login" });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ workspace: "w1", createdBy: "qa-user", name: "Login" });
  });

  it("does not allow a view-only member to create a module", async () => {
    const response = await request(app).post("/api/workspaces/w1/quality/modules").set("x-test-user", "viewer").send({ name: "Login" });
    expect(response.status).toBe(403);
  });
});
