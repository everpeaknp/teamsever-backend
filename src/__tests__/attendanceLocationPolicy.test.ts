import { matchAttendanceArea, validateCoordinate } from "../services/attendanceLocationService";
import { ROLE_PERMISSIONS } from "../permissions/permission.constants";

describe("attendance location policy", () => {
  const policy = { maxAccuracyMeters: 100 };
  const office = [{ _id: "area-1", latitude: 40, longitude: -74, radiusMeters: 150 }];

  it("grants management by default only to owner and admin roles", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("MANAGE_ATTENDANCE_LOCATIONS");
    expect(ROLE_PERMISSIONS.admin).toContain("MANAGE_ATTENDANCE_LOCATIONS");
    expect(ROLE_PERMISSIONS.operations_manager).not.toContain("MANAGE_ATTENDANCE_LOCATIONS");
    expect(ROLE_PERMISSIONS.member).not.toContain("MANAGE_ATTENDANCE_LOCATIONS");
  });

  it("validates coordinate ranges and finite values", () => {
    expect(validateCoordinate(90, -90, 90)).toBe(true);
    expect(validateCoordinate(91, -90, 90)).toBe(false);
    expect(validateCoordinate(Number.NaN, -90, 90)).toBe(false);
  });

  it("matches an accurate fresh fix inside an eligible area", () => {
    const now = new Date();
    const match = matchAttendanceArea({ latitude: 40, longitude: -74, accuracyMeters: 10, capturedAt: now.toISOString() }, office, policy, now);
    expect(String(match.areaId)).toBe("area-1");
    expect(match.distanceMeters).toBe(0);
  });

  it("accepts a point when it is within any eligible radius, not just the nearest center", () => {
    const now = new Date();
    const overlapping = [
      { _id: "small", latitude: 40, longitude: -74, radiusMeters: 25 },
      { _id: "large", latitude: 40.0007, longitude: -74, radiusMeters: 100 }
    ];
    const match = matchAttendanceArea({ latitude: 40.00027, longitude: -74, accuracyMeters: 10, capturedAt: now.toISOString() }, overlapping, policy, now);
    expect(String(match.areaId)).toBe("large");
  });

  it("rejects malformed, stale, future, inaccurate, and out-of-area fixes", () => {
    const now = new Date();
    expect(() => matchAttendanceArea({ latitude: 100, longitude: -74, accuracyMeters: 10, capturedAt: now.toISOString() }, office, policy, now)).toThrow();
    expect(() => matchAttendanceArea({ latitude: 40, longitude: -74, accuracyMeters: 10, capturedAt: new Date(now.getTime() - 121000).toISOString() }, office, policy, now)).toThrow("stale");
    expect(() => matchAttendanceArea({ latitude: 40, longitude: -74, accuracyMeters: 10, capturedAt: new Date(now.getTime() + 16000).toISOString() }, office, policy, now)).toThrow("device clock differs from server time");
    expect(() => matchAttendanceArea({ latitude: 40, longitude: -74, accuracyMeters: 101, capturedAt: now.toISOString() }, office, policy, now)).toThrow("accuracy");
    expect(() => matchAttendanceArea({ latitude: 41, longitude: -74, accuracyMeters: 10, capturedAt: now.toISOString() }, office, policy, now)).toThrow("outside");
  });
});
