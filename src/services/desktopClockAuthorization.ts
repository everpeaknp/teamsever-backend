export type ClockSource = "web" | "desktop" | "mobile";

export function resolveAttendanceClockSource(input: { mobileClockRequest: boolean; desktopDeviceId: string | null | undefined }): ClockSource {
  if (input.mobileClockRequest) return "mobile";
  return input.desktopDeviceId ? "desktop" : "web";
}

export function canClockOutFromClient(entrySource: ClockSource, entryDeviceId: string | null | undefined, requestSource: ClockSource, requestDeviceId: string | null | undefined): boolean {
  if (entrySource !== requestSource) return false;
  if (entrySource === "web" || entrySource === "mobile") return true;
  return !!entryDeviceId && entryDeviceId === requestDeviceId;
}
