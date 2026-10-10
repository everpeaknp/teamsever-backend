const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const Task = require("../models/Task");
const QaReportSnapshot = require("../models/QaReportSnapshot");
const service = require("../services/qaReportService");

const wid = "507f1f77bcf86cd799439011";
const pid = "507f1f77bcf86cd799439012";
const actor = "507f1f77bcf86cd799439013";
const caseIds = Array.from({ length: 20 }, (_, index) => `507f1f77bcf86cd799439${String(index + 100).padStart(3, "0")}`);

describe("QA reports and release gate", () => {
  afterEach(() => jest.restoreAllMocks());

  const setup = (results: any[], openBugs = 0) => {
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: pid, workspace: wid, caseIds, name: "Release 1" });
    const runsQuery: any = { sort: jest.fn(() => runsQuery), select: jest.fn(() => runsQuery), lean: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439099", build: "1.8.5", environment: "staging", status: "closed" }]) };
    jest.spyOn(TestRun, "find").mockReturnValue(runsQuery);
    jest.spyOn(TestExecution, "aggregate").mockResolvedValue(results);
    jest.spyOn(Task, "countDocuments").mockResolvedValue(openBugs);
  };

  it("uses explicit denominators for completion and pass rate", async () => {
    setup([{ result: "pass", count: 12 }, { result: "fail", count: 3 }, { result: "blocked", count: 2 }], 1);
    const report = await service.getLiveReport(wid, pid);
    expect(report.counts).toEqual({ selected: 20, pass: 12, fail: 3, blocked: 2, skipped: 0, notRun: 3 });
    expect(report.completion).toEqual({ numerator: 17, denominator: 20, percent: 85 });
    expect(report.passRate).toEqual({ numerator: 12, denominator: 15, percent: 80 });
    expect(report.gate.ready).toBe(false);
    expect(report.gate.unresolvedHighBugs).toBe(1);
  });

  it("bases the live gate on the latest build rather than a prior run", async () => {
    setup([{ result: "pass", count: 12 }]);
    await service.getLiveReport(wid, pid);
    const pipeline = (TestExecution.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[0].$match.run).toBe("507f1f77bcf86cd799439099");
    expect(pipeline[0].$match.run.$in).toBeUndefined();
  });

  it("shows a zero denominator without a misleading 100 percent", async () => {
    setup([]);
    const report = await service.getLiveReport(wid, pid);
    expect(report.passRate).toEqual({ numerator: 0, denominator: 0, percent: null });
  });

  it("does not sign off a plan that has no run", async () => {
    setup([]);
    const emptyQuery: any = { sort: jest.fn(() => emptyQuery), select: jest.fn(() => emptyQuery), lean: jest.fn().mockResolvedValue([]) };
    jest.spyOn(TestRun, "find").mockReturnValue(emptyQuery);
    await expect(service.signOffPlan(wid, pid, actor)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("keeps signoff gated while the latest run is open", async () => {
    setup([{ result: "pass", count: 20 }]);
    const openQuery: any = { sort: jest.fn(() => openQuery), select: jest.fn(() => openQuery), lean: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439099", build: "1.8.5", environment: "staging", status: "open" }]) };
    jest.spyOn(TestRun, "find").mockReturnValue(openQuery);
    const report = await service.getLiveReport(wid, pid);
    expect(report.gate.ready).toBe(false);
  });

  it("requires an exception reason before signing off blocked work", async () => {
    setup([{ result: "fail", count: 1 }]);
    const create = jest.spyOn(QaReportSnapshot, "create");
    await expect(service.signOffPlan(wid, pid, actor, "")).rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it("saves an immutable copy of the report with actor and exception", async () => {
    setup([{ result: "pass", count: 20 }]);
    const create = jest.spyOn(QaReportSnapshot, "create").mockImplementation(async (input: any) => input);
    const snapshot = await service.signOffPlan(wid, pid, actor);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workspace: wid, plan: pid, signedBy: actor, report: expect.objectContaining({ counts: expect.objectContaining({ pass: 20 }) }) }));
    expect(snapshot.report.gate.ready).toBe(true);
  });
});
