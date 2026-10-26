export function normalizeAuthEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}
