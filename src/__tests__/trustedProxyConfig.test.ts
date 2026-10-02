const { resolveTrustedProxyConfig } = require("../utils/trustedProxyConfig");

describe("trusted proxy configuration", () => {
  it("does not assume a hosting provider or proxy topology", () => {
    expect(resolveTrustedProxyConfig({})).toBeUndefined();
  });

  it("prefers explicitly configured proxy addresses", () => {
    expect(resolveTrustedProxyConfig({ TRUST_PROXY: "10.0.0.0/8, 192.168.1.10" })).toEqual(["10.0.0.0/8", "192.168.1.10"]);
  });

  it("supports an explicit trusted proxy hop count", () => {
    expect(resolveTrustedProxyConfig({ TRUST_PROXY_HOPS: "2" })).toBe(2);
  });

});
