const APP_ID_PATTERN = /^[a-zA-Z0-9._+-]{1,160}$/;

export function normalizeDesktopAppId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return APP_ID_PATTERN.test(normalized) ? normalized : null;
}

export function validDesktopActivityInterval(startedAt: unknown, endedAt: unknown, now = Date.now()): boolean {
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : NaN;
  const end = typeof endedAt === "string" ? Date.parse(endedAt) : NaN;
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 5 * 60_000 && end <= now + 30_000 && start >= now - 10 * 60_000;
}

export function shouldFlagMissingPresenceHeartbeat(lastSeenAt: number | null, now = Date.now(), thresholdMs = 90_000): boolean {
  return typeof lastSeenAt === "number" && Number.isFinite(lastSeenAt) && now - lastSeenAt > thresholdMs;
}

export function getDesktopPresenceGapBaseline(entryStartedAt: unknown, monitoringEnabledAt: unknown, latestHeartbeatAt: unknown): number | null {
  const entryStart = entryStartedAt instanceof Date ? entryStartedAt.getTime() : Date.parse(String(entryStartedAt));
  if (!Number.isFinite(entryStart)) return null;
  const enabledAt = monitoringEnabledAt == null ? entryStart : monitoringEnabledAt instanceof Date ? monitoringEnabledAt.getTime() : Date.parse(String(monitoringEnabledAt));
  const baseline = Math.max(entryStart, Number.isFinite(enabledAt) ? enabledAt : entryStart);
  const latestHeartbeat = latestHeartbeatAt == null ? NaN : latestHeartbeatAt instanceof Date ? latestHeartbeatAt.getTime() : Date.parse(String(latestHeartbeatAt));
  return Number.isFinite(latestHeartbeat) && latestHeartbeat >= baseline ? latestHeartbeat : baseline;
}

export type DesktopPresenceStatus = "active" | "afk" | "unavailable";

export function normalizeDesktopPresenceStatus(value: unknown): DesktopPresenceStatus | null {
  return value === "active" || value === "afk" || value === "unavailable" ? value : null;
}

export function validDesktopPresenceCapabilities(
  presenceStatus: DesktopPresenceStatus,
  foregroundAppSupported: unknown,
  idleDetectionSupported: unknown,
): boolean {
  if (typeof foregroundAppSupported !== "boolean" || typeof idleDetectionSupported !== "boolean") return false;
  return presenceStatus === "unavailable" || idleDetectionSupported;
}
