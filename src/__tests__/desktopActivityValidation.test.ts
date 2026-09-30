
const {
  normalizeDesktopPresenceStatus,
  validDesktopPresenceCapabilities,
  getDesktopPresenceGapBaseline,
} = require("../services/desktopActivityValidation");

describe("desktop presence sample validation", () => {
  it("accepts only active, afk, and unavailable statuses", () => {
    expect(normalizeDesktopPresenceStatus("active")).toBe("active");
    expect(normalizeDesktopPresenceStatus("afk")).toBe("afk");
    expect(normalizeDesktopPresenceStatus("unavailable")).toBe("unavailable");
    expect(normalizeDesktopPresenceStatus("busy")).toBeNull();
    expect(normalizeDesktopPresenceStatus(undefined)).toBeNull();
  });

  it("requires boolean capabilities and a working idle source for active or AFK", () => {
    expect(validDesktopPresenceCapabilities("active", true, true)).toBe(true);
    expect(validDesktopPresenceCapabilities("afk", false, true)).toBe(true);
    expect(validDesktopPresenceCapabilities("active", true, false)).toBe(false);
    expect(validDesktopPresenceCapabilities("unavailable", false, false)).toBe(true);
    expect(validDesktopPresenceCapabilities("active", 1, true)).toBe(false);
  });

  it("starts outage tracking when consent begins and ignores heartbeats from an older consent session", () => {
    const entryStartedAt = new Date("2026-10-01T08:00:00Z");
    const consentAt = new Date("2026-10-01T09:00:00Z");
    expect(getDesktopPresenceGapBaseline(entryStartedAt, consentAt, null)).toBe(consentAt.getTime());
    expect(getDesktopPresenceGapBaseline(entryStartedAt, consentAt, new Date("2026-10-01T08:50:00Z"))).toBe(consentAt.getTime());
    expect(getDesktopPresenceGapBaseline(entryStartedAt, consentAt, new Date("2026-10-01T09:10:00Z"))).toBe(new Date("2026-10-01T09:10:00Z").getTime());
  });
});
