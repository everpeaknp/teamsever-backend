const { mountAttendanceRoutes } = require("../routes/mountAttendanceRoutes");

describe("attendance route mounting", () => {
  it("mounts device-authenticated attendance routes before the JWT-protected attendance router", () => {
    const mounts: Array<[string, unknown]> = [];
    const app = { use: (path: string, router: unknown) => mounts.push([path, router]) };
    const attendanceRouter = { name: "jwt-protected-attendance" };
    const attendanceLocationRouter = { name: "desktop-device-attendance" };

    mountAttendanceRoutes(app, attendanceRouter, attendanceLocationRouter);

    expect(mounts).toEqual([
      ["/api/attendance", attendanceLocationRouter],
      ["/api/attendance", attendanceRouter],
    ]);
  });
});
