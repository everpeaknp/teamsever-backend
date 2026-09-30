import { createHash, randomBytes } from "node:crypto";

export function createDesktopCredential(): string {
  return `td_${randomBytes(36).toString("base64url")}`;
}

export function hashDesktopCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}
