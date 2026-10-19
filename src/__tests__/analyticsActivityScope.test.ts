import { getAnalyticsActivityPerformer } from "../permissions/analyticsAccess";

describe("dashboard activity scope", () => {
  it("limits personal view to the current user", () => {
    expect(getAnalyticsActivityPerformer("personal", "user-1")).toBe("user-1");
  });

  it("keeps workspace view across all permitted workspace members", () => {
    expect(getAnalyticsActivityPerformer("workspace", "user-1")).toBeUndefined();
  });
});
