export function canRecordDesktopPresence(input: {
  monitoringEnabled: boolean;
  isRunning: boolean;
  entrySource: string | undefined;
  entryUserId: string;
  entryDeviceId: string;
  userId: string;
  deviceId: string;
}): boolean {
  return input.monitoringEnabled && input.isRunning && input.entrySource === "desktop" && input.entryUserId === input.userId && input.entryDeviceId === input.deviceId;
}
