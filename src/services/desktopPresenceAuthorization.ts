export function canRecordDesktopPresence(input: {
  monitoringEnabled: boolean;
  isRunning: boolean;
  entrySource: string | undefined;
  entryUserId: string;
  entryDeviceId: string;
  presenceDeviceId?: string;
  companionDeviceId?: string | null;
  userId: string;
  deviceId: string;
}): boolean {
  const ownsClockIn = input.entrySource === "desktop" && input.entryDeviceId === input.deviceId;
  const ownsConsentedPresence = input.presenceDeviceId === input.deviceId;
  const ownsMobileCompanion = input.entrySource === "mobile" && input.companionDeviceId === input.deviceId;
  return input.monitoringEnabled && input.isRunning && input.entryUserId === input.userId && (ownsClockIn || ownsConsentedPresence || ownsMobileCompanion);
}
