import { createHmac } from "node:crypto";

/** Returns a one-way, keyed fingerprint; raw IP addresses are never persisted. */
export function attendanceNetworkFingerprint(ip: string | null | undefined, secret = process.env.ATTENDANCE_NETWORK_FINGERPRINT_SECRET || process.env.JWT_SECRET): string | null {
  if (!ip || !secret) return null;
  return createHmac("sha256", secret).update(ip.trim().toLowerCase()).digest("hex");
}
