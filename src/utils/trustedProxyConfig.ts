type ProxyEnvironment = {
  TRUST_PROXY?: string;
  TRUST_PROXY_HOPS?: string;
};

export function resolveTrustedProxyConfig(env: ProxyEnvironment = process.env): string[] | number | undefined {
  const addresses = (env.TRUST_PROXY || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (addresses.length) return addresses;

  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS !== "") {
    const hops = Number(env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
      throw new Error("TRUST_PROXY_HOPS must be a whole number from 1 to 10");
    }
    return hops;
  }

  return undefined;
}
