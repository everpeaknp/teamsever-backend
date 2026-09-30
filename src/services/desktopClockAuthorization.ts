export type ClockSource = "web" | "desktop";

export function canClockOutFromClient(entrySource: ClockSource, entryDeviceId: string | null | undefined, requestSource: ClockSource, requestDeviceId: string | null | undefined): boolean {
  if (entrySource !== requestSource) return false;
  return entrySource === "web" || (!!entryDeviceId && entryDeviceId === requestDeviceId);
}
