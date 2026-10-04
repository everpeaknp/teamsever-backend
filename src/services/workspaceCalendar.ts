const Workspace = require("../models/Workspace");

export const DEFAULT_WORKSPACE_TIMEZONE = "UTC";

export function isValidTimeZone(timezone: string): boolean {
  if (typeof timezone !== "string" || !timezone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function workspaceCalendarDateKey(date: Date, timezone = DEFAULT_WORKSPACE_TIMEZONE): string {
  const safeZone = isValidTimeZone(timezone) ? timezone : DEFAULT_WORKSPACE_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function canonicalRequestDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isRequestExpired(endDate: Date, now: Date, timezone: string): boolean {
  return canonicalRequestDateKey(endDate) <= workspaceCalendarDateKey(now, timezone);
}

export async function getWorkspaceTimezone(workspaceId: string): Promise<string> {
  const query = Workspace.findOne({ _id: workspaceId, isDeleted: false }).select("timezone");
  const workspace = typeof query.lean === "function" ? await query.lean() : await query;
  return isValidTimeZone(workspace?.timezone) ? workspace.timezone : DEFAULT_WORKSPACE_TIMEZONE;
}
