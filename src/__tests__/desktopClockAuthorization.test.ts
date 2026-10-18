import { canClockOutFromClient } from "../services/desktopClockAuthorization";

describe("cross-client attendance clock-out", () => {
  it("allows a trusted desktop to clock out a shift started on mobile", () => {
    expect(canClockOutFromClient("mobile", null, "desktop", "trusted-device-1")).toBe(true);
  });

  it("allows mobile to clock out a shift started on a desktop", () => {
    expect(canClockOutFromClient("desktop", "trusted-device-1", "mobile", null)).toBe(true);
  });

  it("requires a trusted device when clocking out from desktop", () => {
    expect(canClockOutFromClient("mobile", null, "desktop", null)).toBe(false);
  });
});
