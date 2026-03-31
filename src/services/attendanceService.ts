const TimeEntry = require("../models/TimeEntry");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");

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

    // Logic: 
    // 1. If not admin/owner, they can ONLY see their own data.
    // 2. If admin/owner, they can see anyone's data.
    let targetUserId = userId;
    if (!isOwner && !isAdmin) {
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
      .populate("user", "name email")
      .populate("project", "name")
      .populate("task", "title")
      .sort({ startTime: -1 })
      .lean();

    // Format for report
    const now = new Date();
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

    const headers = ["Name", "Email", "Date", "Clock In", "Clock Out", "Total Hours", "Description"];
    const rows = data.map((item) => [
      item.userName,
      item.userEmail,
      item.date,
      item.clockIn,
      item.clockOut,
      item.totalHours,
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
      { header: 'Description', key: 'description', width: 40 }
    ];

    // Add rows
    worksheet.addRows(data);

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
