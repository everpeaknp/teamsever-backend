import {
  buildHistoryKeysetMatch,
  buildHistoryPagePipeline,
  decodeHistoryCursor,
  decodeRosterCursor,
  encodeHistoryCursor,
  encodeRosterCursor,
} from "../services/desktopPresencePagination";

describe("desktop presence pagination cursors", () => {
  it("round-trips a stable roster name and user-id boundary", () => {
    const cursor = encodeRosterCursor("Ramon", "64b000000000000000000003");

    expect(decodeRosterCursor(cursor)).toEqual({
      name: "ramon",
      userId: "64b000000000000000000003",
    });
  });

  it("rejects malformed roster cursors instead of restarting at the first page", () => {
    expect(() => decodeRosterCursor("not-a-cursor")).toThrow("Invalid desktop presence cursor");
  });

  it("binds history cursors to the workspace, member, and date range", () => {
    const scope = {
      workspaceId: "64b000000000000000000001",
      userId: "64b000000000000000000003",
      startDate: "2026-10-01",
      endDate: "2026-10-07",
    };
    const cursor = encodeHistoryCursor({
      ...scope,
      startedAt: "2026-10-04T10:00:00.000Z",
      id: "64b000000000000000000009",
      kind: "gap",
    });

    expect(decodeHistoryCursor(cursor, scope)).toEqual({
      startedAt: "2026-10-04T10:00:00.000Z",
      id: "64b000000000000000000009",
      kind: "gap",
    });
    expect(() => decodeHistoryCursor(cursor, { ...scope, userId: "64b000000000000000000005" })).toThrow("Invalid desktop presence cursor");
  });
});


describe("history keyset boundaries", () => {
  const query = {
    workspaceId: "64b000000000000000000001",
    userId: "64b000000000000000000003",
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    workspaceObjectId: "workspace-object-id",
    userObjectId: "user-object-id",
    start: new Date("2026-10-01T00:00:00.000Z"),
    end: new Date("2026-10-07T23:59:59.999Z"),
    pageSize: 50,
    gapCollectionName: "desktoptrackinggaps",
  };

  it("orders same-timestamp app and gap rows without overlap between pages", () => {
    expect(buildHistoryKeysetMatch({
      startedAt: "2026-10-04T10:00:00.000Z",
      id: "64b000000000000000000009",
      kind: "app",
    })).toEqual({
      $or: [
        { startedAt: { $lt: new Date("2026-10-04T10:00:00.000Z") } },
        { startedAt: new Date("2026-10-04T10:00:00.000Z"), id: { $lt: "64b000000000000000000009" } },
        { startedAt: new Date("2026-10-04T10:00:00.000Z"), id: "64b000000000000000000009", kindRank: { $gt: 0 } },
      ],
    });
  });

  it("unions only event and gap page rows and caps the database result", () => {
    const pipeline = buildHistoryPagePipeline(query);

    expect(pipeline.some((stage: any) => stage.$unionWith?.coll === "desktoptrackinggaps")).toBe(true);
    expect(pipeline).toContainEqual({ $limit: 51 });
    expect(pipeline[0].$match).toEqual({
      workspace: query.workspaceObjectId,
      user: query.userObjectId,
      startedAt: { $lte: query.end },
      endedAt: { $gte: query.start },
    });
    expect((pipeline[1].$project as any).startedAt).toEqual({ $max: ["$startedAt", query.start] });
    expect((pipeline[1].$project as any).endedAt).toEqual({ $min: ["$endedAt", query.end] });
  });
});
