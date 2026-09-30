const TimeEntry = require("../models/TimeEntry");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const PermissionService = require("../permissions/permission.service");

class AttendanceService {
  /**
   * Get attendance report data
   */
  async getAttendanceReport(workspaceId, adminId, filters) {
    const { startDate, endDate, userId, projectId } = filters;

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    // Check permissions
    const isOwner = workspace.owner.toString() === adminId;
    const member = workspace.members.find(
      (m) => m.user.toString() === adminId
    );
    const isAdmin = member && (member.role === "admin" || member.role === "owner");
    const canManageLocation = String(adminId) === String(workspace.owner) || (await PermissionService.can(adminId, "MANAGE_ADDRESSES", { userId: adminId, workspaceId })) || (await PermissionService.can(adminId, "MANAGE_ATTENDANCE_LOCATIONS", { userId: adminId, workspaceId }));

    // Logic: 
    // 1. If not admin/owner, they can ONLY see their own data.
    // 2. If admin/owner, they can see anyone's data.
    let targetUserId = userId;
    if (!isOwner && !isAdmin && !canManageLocation) {
      targetUserId = adminId; // Force self-only for non-admins
    }

    // Build query
    const matchQuery: any = {
      workspace: workspace._id,
      isDeleted: false
    };

    if (targetUserId && targetUserId !== 'all' && targetUserId !== '') {
      matchQuery.user = targetUserId;
    }

    if (projectId && projectId !== 'all' && projectId !== '') {
      matchQuery.project = projectId;
    }

    if (startDate || endDate) {
      matchQuery.startTime = {};
      if (startDate && startDate !== 'null' && startDate !== 'undefined') {
        const sDate = new Date(startDate);
        if (!isNaN(sDate.getTime())) {
          matchQuery.startTime.$gte = sDate;
        }
      }
      if (endDate && endDate !== 'null' && endDate !== 'undefined') {
        const eDate = new Date(endDate);
        if (!isNaN(eDate.getTime())) {
          // Set to end of day
          eDate.setHours(23, 59, 59, 999);
          matchQuery.startTime.$lte = eDate;
        }
      }
      
      // If no valid dates were added, remove the empty startTime object
      if (Object.keys(matchQuery.startTime).length === 0) {
        delete matchQuery.startTime;
      }
    }

    // Fetch entries with populated data
    const entries = await TimeEntry.find(matchQuery)
      .select("+clockInLocation +clockOutLocation")
      .populate("user", "name email avatar profilePicture")
      .populate("project", "name")
      .populate("task", "title")
      .sort({ startTime: -1 })
      .lean();

    // Format for report
    const now = new Date();
    const canSeePreciseLocations = String(adminId) === String(workspace.owner) || (await PermissionService.can(adminId, "MANAGE_ADDRESSES", { userId: adminId, workspaceId })) || (await PermissionService.can(adminId, "MANAGE_ATTENDANCE_LOCATIONS", { userId: adminId, workspaceId }));
    const reportData = entries.map((entry) => {
      const startTime = new Date(entry.startTime);
      const isRunning = !entry.endTime || entry.isRunning;
      const endTime = entry.endTime ? new Date(entry.endTime) : (isRunning ? now : null);
      
      let durationSeconds = entry.duration || 0;
      if (isRunning && startTime) {
        durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      } else if (endTime && startTime && !durationSeconds) {
        durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }
      
      return {
        id: entry._id,
        user: entry.user, // Pass full user object for UserAvatar component
        userName: entry.user?.name || "Unknown",
        userEmail: entry.user?.email || "N/A",
        date: startTime.toISOString().split("T")[0],
        clockIn: startTime.toISOString(),
        clockOut: isRunning ? "Running" : (endTime ? endTime.toISOString() : "N/A"),
        totalHours: (durationSeconds / 3600).toFixed(2),
        durationFormatted: this.formatDuration(durationSeconds),
        projectName: entry.project?.name || "N/A",
        taskTitle: entry.task?.title || "N/A",
        description: entry.description || ""
        ,attendanceMode: entry.attendanceMode || "onsite"
        ,clockInSource: entry.clockInSource || "web"
        ,clockOutSource: entry.clockOutSource || null
        ,clockInVerificationMethod: entry.clockInVerificationMethod || (entry.clockInLocation ? "gps" : null)
        ,clockInLocation: entry.clockInLocation ? { areaName: entry.clockInLocation.areaName || "Allowed area", latitude: (String(entry.user?._id || entry.user) === String(adminId) || canSeePreciseLocations) ? entry.clockInLocation.latitude : undefined, longitude: (String(entry.user?._id || entry.user) === String(adminId) || canSeePreciseLocations) ? entry.clockInLocation.longitude : undefined, accuracyMeters: entry.clockInLocation.accuracyMeters, capturedAt: entry.clockInLocation.capturedAt } : null
        ,clockOutLocation: entry.clockOutLocation ? { latitude: (String(entry.user?._id || entry.user) === String(adminId) || canSeePreciseLocations) ? entry.clockOutLocation.latitude : undefined, longitude: (String(entry.user?._id || entry.user) === String(adminId) || canSeePreciseLocations) ? entry.clockOutLocation.longitude : undefined, accuracyMeters: entry.clockOutLocation.accuracyMeters, capturedAt: entry.clockOutLocation.capturedAt, distanceFromClockInMeters: entry.clockOutLocation.distanceFromClockInMeters, withinRange: entry.clockOutLocation.withinRange } : null
        ,locationReviewReason: entry.locationReviewReason || null
      };
    });

    return reportData;
  }

  /**
   * Format attendance report to CSV
   */
  async exportAttendanceCSV(workspaceId, adminId, filters) {
    const data = await this.getAttendanceReport(workspaceId, adminId, filters);

    if (!data || data.length === 0) {
      return "No data found for the selected filters.";
    }

    const headers = ["Name", "Email", "Date", "Clock In", "Clock Out", "Total Hours", "Mode", "Clock-in Source", "Clock-out Source", "Clock-in Area", "Clock-in Verification", "Clock-in Latitude", "Clock-in Longitude", "Clock-out Latitude", "Clock-out Longitude", "Clock-out Distance (m)", "Location Review", "Description"];
    const rows = data.map((item) => [
      item.userName,
      item.userEmail,
      item.date,
      item.clockIn,
      item.clockOut,
      item.totalHours,
      item.attendanceMode,
      item.clockInSource,
      item.clockOutSource || "",
      item.clockInLocation?.areaName || "Location not recorded",
      item.clockInVerificationMethod || "not recorded",
      item.clockInLocation?.latitude ?? "",
      item.clockInLocation?.longitude ?? "",
      item.clockOutLocation?.latitude ?? "",
      item.clockOutLocation?.longitude ?? "",
      item.clockOutLocation?.distanceFromClockInMeters ?? "",
      item.locationReviewReason || "",
      item.description.replace(/,/g, ";") // Basic CSV escaping for descriptions
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    return csvContent;
  }

  /**
   * Format attendance report to Excel (.xlsx)
   */
  async exportAttendanceExcel(workspaceId, adminId, filters) {
    const ExcelJS = require('exceljs');
    const data = await this.getAttendanceReport(workspaceId, adminId, filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Define columns
    worksheet.columns = [
      { header: 'Name', key: 'userName', width: 25 },
      { header: 'Email', key: 'userEmail', width: 30 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Clock In', key: 'clockIn', width: 25 },
      { header: 'Clock Out', key: 'clockOut', width: 25 },
      { header: 'Total Hours', key: 'totalHours', width: 15 },
      { header: 'Mode', key: 'attendanceMode', width: 12 },
      { header: 'Clock-in Source', key: 'clockInSource', width: 16 },
      { header: 'Clock-out Source', key: 'clockOutSource', width: 16 },
      { header: 'Clock-in Area', key: 'clockInArea', width: 24 },
      { header: 'Clock-in Verification', key: 'clockInVerificationMethod', width: 24 },
      { header: 'Clock-in Latitude', key: 'clockInLatitude', width: 18 },
      { header: 'Clock-in Longitude', key: 'clockInLongitude', width: 18 },
      { header: 'Clock-out Latitude', key: 'clockOutLatitude', width: 18 },
      { header: 'Clock-out Longitude', key: 'clockOutLongitude', width: 18 },
      { header: 'Clock-out Distance (m)', key: 'clockOutDistance', width: 22 },
      { header: 'Location Review', key: 'locationReviewReason', width: 36 },
      { header: 'Description', key: 'description', width: 40 }
    ];

    // Add rows
    worksheet.addRows(data.map((row) => ({ ...row, clockInArea: row.clockInLocation?.areaName || "Location not recorded", clockInLatitude: row.clockInLocation?.latitude, clockInLongitude: row.clockInLocation?.longitude, clockOutLatitude: row.clockOutLocation?.latitude, clockOutLongitude: row.clockOutLocation?.longitude, clockOutDistance: row.clockOutLocation?.distanceFromClockInMeters })));

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

module.exports = new AttendanceService();
export {};
