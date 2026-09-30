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
