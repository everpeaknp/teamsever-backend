export type DesktopPresenceHistoryKind = "app" | "gap";

export interface DesktopPresenceHistoryScope {
  workspaceId: string;
  userId: string;
  startDate: string;
  endDate: string;
}

export interface DesktopPresenceHistoryBoundary {
  startedAt: string;
  id: string;
  kind: DesktopPresenceHistoryKind;
}

type RosterCursorPayload = { version: 1; name: string; userId: string };
type HistoryCursorPayload = DesktopPresenceHistoryScope & DesktopPresenceHistoryBoundary & { version: 1 };

const INVALID_CURSOR = "Invalid desktop presence cursor";

function encodePayload(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodePayload<T>(cursor: string): T {
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new Error(INVALID_CURSOR);
  }
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error(INVALID_CURSOR);
    return decoded as T;
  } catch {
    throw new Error(INVALID_CURSOR);
  }
}

export function encodeRosterCursor(name: string, userId: string): string {
  return encodePayload({ version: 1, name: name.normalize("NFKC").trim().toLocaleLowerCase("en"), userId });
}

export function decodeRosterCursor(cursor: string): { name: string; userId: string } {
  const payload = decodePayload<RosterCursorPayload>(cursor);
  if (payload.version !== 1 || typeof payload.name !== "string" || !payload.name || typeof payload.userId !== "string" || !payload.userId) {
    throw new Error(INVALID_CURSOR);
  }
  return { name: payload.name, userId: payload.userId };
}

export function encodeHistoryCursor(value: DesktopPresenceHistoryScope & DesktopPresenceHistoryBoundary): string {
  return encodePayload({ version: 1, ...value });
}

export function decodeHistoryCursor(
  cursor: string,
  scope: DesktopPresenceHistoryScope,
): DesktopPresenceHistoryBoundary {
  const payload = decodePayload<HistoryCursorPayload>(cursor);
  const matchesScope = payload.version === 1 &&
    payload.workspaceId === scope.workspaceId &&
    payload.userId === scope.userId &&
    payload.startDate === scope.startDate &&
    payload.endDate === scope.endDate;
  const timestamp = typeof payload.startedAt === "string" ? Date.parse(payload.startedAt) : Number.NaN;
  const validBoundary = Number.isFinite(timestamp) && new Date(timestamp).toISOString() === payload.startedAt &&
    typeof payload.id === "string" && payload.id.length > 0 &&
    (payload.kind === "app" || payload.kind === "gap");
  if (!matchesScope || !validBoundary) throw new Error(INVALID_CURSOR);
  return { startedAt: payload.startedAt, id: payload.id, kind: payload.kind };
}

export function parseDesktopPresencePageSize(value: unknown): number {
  if (value === undefined) return 50;
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new Error("Page size must be a whole number from 1 to 100");
  return parsed;
}

export interface DesktopPresenceHistoryQuery extends DesktopPresenceHistoryScope {
  workspaceObjectId: unknown;
  userObjectId: unknown;
  start: Date;
  end: Date;
  pageSize: number;
  cursor?: DesktopPresenceHistoryBoundary | null;
  gapCollectionName: string;
}

export function buildHistoryKeysetMatch(cursor: DesktopPresenceHistoryBoundary): Record<string, unknown> {
  const kindRank = cursor.kind === "app" ? 0 : 1;
  return {
    $or: [
      { startedAt: { $lt: new Date(cursor.startedAt) } },
      { startedAt: new Date(cursor.startedAt), id: { $lt: cursor.id } },
      { startedAt: new Date(cursor.startedAt), id: cursor.id, kindRank: { $gt: kindRank } },
    ],
  };
}

export function buildHistoryPagePipeline(query: DesktopPresenceHistoryQuery): Record<string, unknown>[] {
  const appMatch = {
    workspace: query.workspaceObjectId,
    user: query.userObjectId,
    startedAt: { $lte: query.end },
    endedAt: { $gte: query.start },
  };
  const gapMatch = {
    workspace: query.workspaceObjectId,
    user: query.userObjectId,
    gapStartedAt: { $lte: query.end },
    gapEndedAt: { $gte: query.start },
  };
  const pipeline: Record<string, unknown>[] = [
    { $match: appMatch },
    { $project: {
      _id: 0,
      id: { $toString: "$_id" },
      kind: { $literal: "app" },
      kindRank: { $literal: 0 },
      appId: 1,
      presenceStatus: 1,
      foregroundAppSupported: 1,
      idleDetectionSupported: 1,
      startedAt: { $max: ["$startedAt", query.start] },
      endedAt: { $min: ["$endedAt", query.end] },
    } },
    { $unionWith: {
      coll: query.gapCollectionName,
      pipeline: [
        { $match: gapMatch },
        { $project: {
          _id: 0,
          id: { $toString: "$_id" },
          kind: { $literal: "gap" },
          kindRank: { $literal: 1 },
          appId: { $literal: null },
          reason: 1,
          active: { $literal: false },
          startedAt: { $max: ["$gapStartedAt", query.start] },
          endedAt: { $min: ["$gapEndedAt", query.end] },
        } },
      ],
    } },
  ];
  if (query.cursor) pipeline.push({ $match: buildHistoryKeysetMatch(query.cursor) });
  pipeline.push({ $sort: { startedAt: -1, id: -1, kindRank: 1 } });
  pipeline.push({ $limit: query.pageSize + 1 });
  pipeline.push({ $project: { _id: 0, kindRank: 0 } });
  return pipeline;
}

export function buildHistorySummaryPipeline(input: { workspaceObjectId: unknown; userObjectId: unknown; start: Date; end: Date }): Record<string, unknown>[] {
  return [
    { $match: { workspace: input.workspaceObjectId, user: input.userObjectId, startedAt: { $lte: input.end }, endedAt: { $gte: input.start } } },
    { $set: {
      clippedStart: { $max: ["$startedAt", input.start] },
      clippedEnd: { $min: ["$endedAt", input.end] },
    } },
    { $set: { durationMs: { $subtract: ["$clippedEnd", "$clippedStart"] } } },
    { $setWindowFields: {
      partitionBy: "$timeEntry",
      sortBy: { startedAt: 1, _id: 1 },
      output: {
        previousAppId: { $shift: { output: "$appId", by: -1, default: null } },
        previousEndedAt: { $shift: { output: "$endedAt", by: -1, default: null } },
      },
    } },
    { $set: { newSession: { $or: [
      { $eq: ["$previousEndedAt", null] },
      { $ne: ["$appId", "$previousAppId"] },
      { $gt: [{ $subtract: ["$startedAt", "$previousEndedAt"] }, 90_000] },
    ] } } },
    { $group: {
      _id: { appId: "$appId", presenceStatus: "$presenceStatus" },
      durationMs: { $sum: "$durationMs" },
      sessions: { $sum: { $cond: ["$newSession", 1, 0] } },
    } },
  ];
}
