const attendanceService = require("../services/attendanceService");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get attendance report
// @route   GET /api/attendance/workspace/:workspaceId/report
// @access  Private
const getAttendanceReport = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { startDate, endDate, userId, projectId } = req.query;

  const data = await attendanceService.getAttendanceReport(
    workspaceId,
    req.user.id,
    { startDate, endDate, userId, projectId }
  );

  res.status(200).json({
    success: true,
    data
  });
});

// @desc    Export attendance as CSV
// @route   GET /api/attendance/workspace/:workspaceId/export
// @access  Private
const exportAttendanceCSV = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { startDate, endDate, userId, projectId } = req.query;

  const csvData = await attendanceService.exportAttendanceCSV(
    workspaceId,
    req.user.id,
    { startDate, endDate, userId, projectId }
  );

  const filename = `Attendance_Report_${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.status(200).send(csvData);
});

// @desc    Export attendance as Excel (.xlsx)
// @route   GET /api/attendance/workspace/:workspaceId/export-excel
// @access  Private
const exportAttendanceExcel = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { startDate, endDate, userId, projectId } = req.query;

  const excelBuffer = await attendanceService.exportAttendanceExcel(
    workspaceId,
    req.user.id,
    { startDate, endDate, userId, projectId }
  );

  const filename = `Attendance_Report_${new Date().toISOString().split("T")[0]}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.status(200).send(excelBuffer);
});

module.exports = {
  getAttendanceReport,
  exportAttendanceCSV,
  exportAttendanceExcel
};
export {};
