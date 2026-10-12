const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const TestCase = require("../models/TestCase");
const User = require("../models/User");
const Attachment = require("../models/Attachment");
const PermissionService = require("../permissions/permission.service");
const qaProjectService = require("../services/qaProjectService");
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
    jest.spyOn(qaProjectService, "getProjectScope").mockResolvedValue({ project: { _id: pid }, filter: { project: { $in: [pid, null] } } });
    jest.spyOn(TestPlan, "findOne").mockResolvedValue({ _id: pid, workspace: wid, caseIds, name: "Release 1" });
    const runsQuery: any = { sort: jest.fn(() => runsQuery), select: jest.fn(() => runsQuery), lean: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439099", build: "1.8.5", environment: "staging", status: "closed" }]) };
    jest.spyOn(TestRun, "find").mockReturnValue(runsQuery);
    jest.spyOn(TestExecution, "aggregate").mockResolvedValue(results);
    const emptyQuery: any = { select: jest.fn(() => emptyQuery), lean: jest.fn().mockResolvedValue([]) };
    jest.spyOn(TestExecution, "find").mockReturnValue(emptyQuery);
    jest.spyOn(TestCase, "find").mockReturnValue(emptyQuery);
    jest.spyOn(Task, "find").mockReturnValue(emptyQuery);
    jest.spyOn(User, "find").mockReturnValue(emptyQuery);
    jest.spyOn(Attachment, "find").mockReturnValue(emptyQuery);
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

  it("includes case-level execution evidence and linked bug verification in the report", async () => {
    setup([{ result: "pass", count: 1 }]);
    const executionQuery: any = { select: jest.fn(() => executionQuery), lean: jest.fn().mockResolvedValue([{
      testCase: caseIds[0], caseKey: "TC-001", revision: 2, snapshot: { title: "Sign in", steps: [{ action: "Submit form", expectedResult: "Dashboard opens" }] },
      result: "pass", reason: "Confirmed on staging", lastUpdatedBy: actor, updatedAt: new Date("2026-10-10T12:00:00Z"),
      stepResults: [{ result: "pass", actualResult: "Dashboard opened", evidenceIds: [] }], bugIds: ["507f1f77bcf86cd799439077"], evidenceIds: [],
    }]) };
    (TestExecution.find as jest.Mock).mockReturnValue(executionQuery);
    const missingCasesQuery: any = { select: jest.fn(() => missingCasesQuery), lean: jest.fn().mockResolvedValue([]) };
    (TestCase.find as jest.Mock).mockReturnValue(missingCasesQuery);
    const bugsQuery: any = { select: jest.fn(() => bugsQuery), lean: jest.fn().mockResolvedValue([{
      _id: "507f1f77bcf86cd799439077", title: "Sign-in regression", status: "done", priority: "high", assignee: actor,
      list: "507f1f77bcf86cd799439088", space: "507f1f77bcf86cd799439089",
      bugHistory: [{ action: "verify", actor, reason: "Retested on staging", at: new Date("2026-10-10T12:05:00Z") }],
    }]) };
    (Task.find as jest.Mock).mockReturnValue(bugsQuery);
    const usersQuery: any = { select: jest.fn(() => usersQuery), lean: jest.fn().mockResolvedValue([{ _id: actor, name: "QA Tester" }]) };
    (User.find as jest.Mock).mockReturnValue(usersQuery);
    const evidenceQuery: any = { select: jest.fn(() => evidenceQuery), lean: jest.fn().mockResolvedValue([]) };
    (Attachment.find as jest.Mock).mockReturnValue(evidenceQuery);
    jest.spyOn(PermissionService, "can").mockResolvedValue(true);

    const report = await service.getLiveReport(wid, pid, "workspace", actor);
    expect(report.cases[0]).toEqual(expect.objectContaining({
      key: "TC-001", title: "Sign in", result: "pass", tester: "QA Tester", reason: "Confirmed on staging",
      steps: [expect.objectContaining({ actualResult: "Dashboard opened", result: "pass" })],
      linkedBugs: [expect.objectContaining({ title: "Sign-in regression", verification: expect.objectContaining({ status: "verified", verifiedBy: "QA Tester" }) })],
    }));
    expect(report.cases).toHaveLength(caseIds.length);
    expect(report.cases[1].result).toBe("not_run");
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
    const create = jest.spyOn(QaReportSnapshot, "create").mockImplementation(async (input: any) => ({ ...input, toObject: () => input } as any));
    const signerQuery: any = { select: jest.fn(() => signerQuery), lean: jest.fn().mockResolvedValue({ name: "QA Tester" }) };
    jest.spyOn(User, "findById").mockReturnValue(signerQuery);
    const snapshot = await service.signOffPlan(wid, pid, actor);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workspace: wid, plan: pid, signedBy: actor, report: expect.objectContaining({ counts: expect.objectContaining({ pass: 20 }) }) }));
    expect(snapshot.report.gate.ready).toBe(true);
  });
});
