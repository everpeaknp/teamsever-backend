jest.mock("../middlewares/authMiddleware", () => ({
  protect: (req: any, _res: any, next: any) => { req.user = { id: "qa-1" }; next(); },
}));
jest.mock("../permissions/permission.middleware", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../services/bugWorkflowService", () => ({
  transitionBug: jest.fn().mockResolvedValue({ _id: "bug-1", status: "done" }),
  listVerificationRetests: jest.fn().mockResolvedValue({ retests: [{ _id: "run-1" }], canVerify: true }),
}));

const express = require("express");
const request = require("supertest");
const { taskRouter } = require("../routes/taskRoutes");
const workflow = require("../services/bugWorkflowService");

const app = express();
app.use(express.json());
app.use("/api/tasks", taskRouter);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ message: error.message }));

describe("bug transition endpoint", () => {
  it("passes the authenticated actor and mutation key to the workflow", async () => {
    const response = await request(app).post("/api/tasks/bug-1/quality-transition").send({
      action: "verify", idempotencyKey: "verify-1", reason: "Passed on build 1.8.5",
    });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("done");
    expect(workflow.transitionBug).toHaveBeenCalledWith("bug-1", "verify", "qa-1", expect.objectContaining({ idempotencyKey: "verify-1" }));
  });

  it("rejects an unknown action before changing a bug", async () => {
    workflow.transitionBug.mockClear();
    const response = await request(app).post("/api/tasks/bug-1/quality-transition").send({ action: "approve", idempotencyKey: "bad-1" });
    expect(response.status).toBe(400);
    expect(workflow.transitionBug).not.toHaveBeenCalled();
  });

  it("returns linked passing retests for the authenticated verifier", async () => {
    const response = await request(app).get("/api/tasks/bug-1/quality-retests");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ retests: [{ _id: "run-1" }], canVerify: true });
    expect(workflow.listVerificationRetests).toHaveBeenCalledWith("bug-1", "qa-1");
  });

  it("rejects malformed retest IDs at the route boundary", async () => {
    workflow.transitionBug.mockClear();
    const response = await request(app).post("/api/tasks/bug-1/quality-transition").send({
      action: "verify", idempotencyKey: "verify-bad-run", reason: "Passed", executionId: "not-an-id",
    });
    expect(response.status).toBe(400);
    expect(workflow.transitionBug).not.toHaveBeenCalled();
  });
});
