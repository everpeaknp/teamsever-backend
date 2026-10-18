export type ClockSource = "web" | "desktop" | "mobile";

export function resolveAttendanceClockSource(input: { mobileClockRequest: boolean; desktopDeviceId: string | null | undefined }): ClockSource {
  if (input.mobileClockRequest) return "mobile";
  return input.desktopDeviceId ? "desktop" : "web";
}

export function canClockOutFromClient(entrySource: ClockSource, entryDeviceId: string | null | undefined, requestSource: ClockSource, requestDeviceId: string | null | undefined): boolean {
  // The route authenticates the user (and desktop routes also require a
  // trusted device). A shift belongs to that user, so the user may end it from
  // another signed-in client. Keep this check as a guard against an
  // unauthenticated desktop source; location policy is validated separately.
  void entrySource;
  void entryDeviceId;
  return requestSource !== "desktop" || !!requestDeviceId;
}
