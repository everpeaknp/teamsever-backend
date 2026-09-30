const https = require("https");
const net = require("net");

let cachedPublicIp: string | null = null;
let cacheExpiresAt = 0;

function normalizeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let ip = value.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return net.isIP(ip) ? ip : null;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return ip === "::1" || ip === "::" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb");
}

function lookupPublicEgressIp(): Promise<string | null> {
  if (cachedPublicIp && Date.now() < cacheExpiresAt) return Promise.resolve(cachedPublicIp);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ip: string | null) => {
      if (settled) return;
      settled = true;
      if (ip) {
        cachedPublicIp = ip;
        cacheExpiresAt = Date.now() + 60_000;
      }
      resolve(ip);
    };
    const request = https.get("https://api.ipify.org", { timeout: 2000 }, (response: any) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => finish(normalizeIp(body)));
      response.on("error", () => finish(null));
    });
    request.on("timeout", () => { request.destroy(); finish(null); });
    request.on("error", () => finish(null));
  });
}

/**
 * In local development the browser connects to localhost, hiding the user's
 * network IP from Express. Resolve the machine's public egress IP only for a
 * local/private peer. Production must use the actual request IP and trusted
 * proxy configuration instead.
 */
export async function resolveAttendanceClientIp(remoteAddress: unknown, env = process.env.NODE_ENV, lookup = lookupPublicEgressIp): Promise<string | null> {
  const ip = normalizeIp(remoteAddress);
  if (!ip) return null;
  if (env === "production" || !isPrivateOrLoopbackIp(ip)) return ip;
  return (await lookup()) || ip;
}

export const __testing = { normalizeIp, isPrivateOrLoopbackIp };
