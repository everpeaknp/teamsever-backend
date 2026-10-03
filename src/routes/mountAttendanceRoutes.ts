type RouteMountApp = {
  use: (path: string, router: unknown) => unknown;
};

export function mountAttendanceRoutes(
  app: RouteMountApp,
  attendanceRouter: unknown,
  attendanceLocationRouter: unknown,
): void {
  // The legacy attendance router calls protect() for every unmatched path.
  // Mount desktop credential routes first so they don't get intercepted by JWT auth.
  app.use("/api/attendance", attendanceLocationRouter);
  app.use("/api/attendance", attendanceRouter);
}
