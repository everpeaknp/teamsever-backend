"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TimeEntry = require("../models/TimeEntry");
const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { emitTaskEvent, emitWorkspaceEvent } = require("../socket/events");
class TimeEntryService {
    /**
     * Start a timer for a task
     */
    async startTimer(data) {
        const { taskId, userId, description } = data;
        // Verify task exists
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You must be a workspace member to track time", 403);
        }
        // Check if user already has a running timer
        const runningTimer = await TimeEntry.findOne({
            user: userId,
            isRunning: true,
            isDeleted: false
        });
        if (runningTimer) {
            throw new AppError("You already have a running timer. Please stop it before starting a new one.", 400);
        }
        // Create time entry
        const timeEntry = await TimeEntry.create({
            task: taskId,
            user: userId,
            workspace: task.workspace,
            project: task.space,
            startTime: new Date(),
            description,
            isRunning: true
        });
        // Populate for response
        await timeEntry.populate([
            { path: "task", select: "title status" },
            { path: "user", select: "name email" }
        ]);
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: task.workspace.toString(),
                action: "CREATE",
                resourceType: "TimeEntry",
                resourceId: timeEntry._id.toString(),
                metadata: {
                    taskId,
                    taskTitle: task.title,
                    action: "timer_started"
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitTaskEvent(taskId, "timer_started", {
                timeEntry: {
                    _id: timeEntry._id,
                    user: timeEntry.user,
                    startTime: timeEntry.startTime
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return timeEntry;
    }
    /**
     * Stop a running timer
     */
    async stopTimer(data) {
        const { entryId, userId } = data;
        const timeEntry = await TimeEntry.findOne({
            _id: entryId,
            isDeleted: false
        });
        if (!timeEntry) {
            throw new AppError("Time entry not found", 404);
        }
        // Verify ownership
        if (timeEntry.user.toString() !== userId) {
            throw new AppError("You can only stop your own timers", 403);
        }
        // Verify timer is running
        if (!timeEntry.isRunning) {
            throw new AppError("This timer is not running", 400);
        }
        // Stop timer
        timeEntry.endTime = new Date();
        timeEntry.isRunning = false;
        // Duration will be calculated by pre-save hook
        await timeEntry.save();
        // Populate for response
        await timeEntry.populate([
            { path: "task", select: "title status" },
            { path: "user", select: "name email" }
        ]);
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: timeEntry.workspace.toString(),
                action: "UPDATE",
                resourceType: "TimeEntry",
                resourceId: timeEntry._id.toString(),
                metadata: {
                    taskId: timeEntry.task.toString(),
                    action: "timer_stopped",
                    duration: timeEntry.duration
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitTaskEvent(timeEntry.task.toString(), "timer_stopped", {
                timeEntry: {
                    _id: timeEntry._id,
                    user: timeEntry.user,
                    startTime: timeEntry.startTime,
                    endTime: timeEntry.endTime,
                    duration: timeEntry.duration
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return timeEntry;
    }
    /**
     * Add manual time entry
     */
    async addManualTime(data) {
        const { taskId, userId, startTime, endTime, description } = data;
        // Verify task exists
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You must be a workspace member to track time", 403);
        }
        // Validate dates
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (isNaN(start.getTime())) {
            throw new AppError("Invalid start time", 400);
        }
        if (isNaN(end.getTime())) {
            throw new AppError("Invalid end time", 400);
        }
        if (end <= start) {
            throw new AppError("End time must be after start time", 400);
        }
        // Calculate duration
        const durationMs = end.getTime() - start.getTime();
        const duration = Math.floor(durationMs / 1000);
        // Create time entry
        const timeEntry = await TimeEntry.create({
            task: taskId,
            user: userId,
            workspace: task.workspace,
            project: task.space,
            startTime: start,
            endTime: end,
            duration,
            description,
            isRunning: false
        });
        // Populate for response
        await timeEntry.populate([
            { path: "task", select: "title status" },
            { path: "user", select: "name email" }
        ]);
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: task.workspace.toString(),
                action: "CREATE",
                resourceType: "TimeEntry",
                resourceId: timeEntry._id.toString(),
                metadata: {
                    taskId,
                    taskTitle: task.title,
                    action: "manual_entry_added",
                    duration
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event
        try {
            emitTaskEvent(taskId, "time_entry_added", {
                timeEntry: {
                    _id: timeEntry._id,
                    user: timeEntry.user,
                    startTime: timeEntry.startTime,
                    endTime: timeEntry.endTime,
                    duration: timeEntry.duration
                }
            }, userId);
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return timeEntry;
    }
    /**
     * Get time summary for a task
     */
    async getTaskTimeSummary(taskId, userId) {
        // Verify task exists and user has access
        const task = await Task.findOne({
            _id: taskId,
            isDeleted: false
        });
        if (!task) {
            throw new AppError("Task not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: task.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this task", 403);
        }
        // Get all time entries for task
        const timeEntries = await TimeEntry.find({
            task: taskId,
            isDeleted: false
        })
            .populate("user", "name email")
            .sort("-startTime")
            .lean();
        // Calculate total duration
        let totalDuration = 0;
        let runningEntry = null;
        for (const entry of timeEntries) {
            if (entry.isRunning) {
                runningEntry = entry;
                // Calculate current duration for running timer
                const currentDuration = Math.floor((Date.now() - new Date(entry.startTime).getTime()) / 1000);
                totalDuration += currentDuration;
            }
            else {
                totalDuration += entry.duration || 0;
            }
        }
        return {
            task: {
                _id: task._id,
                title: task.title
            },
            totalDuration, // in seconds
            totalDurationFormatted: this.formatDuration(totalDuration),
            entryCount: timeEntries.length,
            runningEntry,
            entries: timeEntries
        };
    }
    /**
     * Get time summary for a project
     */
    async getProjectTimeSummary(projectId, userId) {
        // Verify project exists
        const project = await require("../models/Space").findOne({
            _id: projectId,
            isDeleted: false
        });
        if (!project) {
            throw new AppError("Project not found", 404);
        }
        // Verify user is workspace member
        const workspace = await Workspace.findOne({
            _id: project.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        const isMember = workspace.members.some((member) => member.user.toString() === userId);
        if (!isMember) {
            throw new AppError("You do not have access to this project", 403);
        }
        // Aggregate time entries by task
        const summary = await TimeEntry.aggregate([
            {
                $match: {
                    project: project._id,
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: "$task",
                    totalDuration: { $sum: "$duration" },
                    entryCount: { $sum: 1 },
                    users: { $addToSet: "$user" }
                }
            },
            {
                $lookup: {
                    from: "tasks",
                    localField: "_id",
                    foreignField: "_id",
                    as: "taskInfo"
                }
            },
            {
                $unwind: "$taskInfo"
            },
            {
                $project: {
                    task: {
                        _id: "$taskInfo._id",
                        title: "$taskInfo.title",
                        status: "$taskInfo.status"
                    },
                    totalDuration: 1,
                    totalDurationFormatted: 1,
                    entryCount: 1,
                    userCount: { $size: "$users" }
                }
            },
            {
                $sort: { totalDuration: -1 }
            }
        ]);
        // Calculate project total
        const projectTotal = summary.reduce((sum, item) => sum + item.totalDuration, 0);
        // Format durations
        summary.forEach((item) => {
            item.totalDurationFormatted = this.formatDuration(item.totalDuration);
        });
        return {
            project: {
                _id: project._id,
                name: project.name
            },
            totalDuration: projectTotal,
            totalDurationFormatted: this.formatDuration(projectTotal),
            taskCount: summary.length,
            tasks: summary
        };
    }
    /**
     * Get user's running timer
     */
    async getRunningTimer(userId) {
        const runningTimer = await TimeEntry.findOne({
            user: userId,
            isRunning: true,
            isDeleted: false
        })
            .populate("task", "title status")
            .populate("user", "name email")
            .lean();
        if (!runningTimer) {
            return null;
        }
        // Calculate current duration
        const currentDuration = Math.floor((Date.now() - new Date(runningTimer.startTime).getTime()) / 1000);
        return {
            ...runningTimer,
            currentDuration,
            currentDurationFormatted: this.formatDuration(currentDuration)
        };
    }
    /**
     * Delete time entry
     */
    async deleteTimeEntry(entryId, userId) {
        const timeEntry = await TimeEntry.findOne({
            _id: entryId,
            isDeleted: false
        });
        if (!timeEntry) {
            throw new AppError("Time entry not found", 404);
        }
        // Verify ownership
        if (timeEntry.user.toString() !== userId) {
            throw new AppError("You can only delete your own time entries", 403);
        }
        // Soft delete
        timeEntry.isDeleted = true;
        timeEntry.deletedAt = new Date();
        await timeEntry.save();
        // Log activity
        try {
            await logger.logActivity({
                userId,
                workspaceId: timeEntry.workspace.toString(),
                action: "DELETE",
                resourceType: "TimeEntry",
                resourceId: timeEntry._id.toString()
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        return { message: "Time entry deleted successfully" };
    }
    /**
     * Format duration in seconds to human-readable format
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        else {
            return `${secs}s`;
        }
    }
    // ============================================
    // ADMIN TIME TRACKING METHODS
    // ============================================
    /**
     * Get all active timers for a workspace (Admin only)
     * Returns all running timers with user and task details
     */
    async getWorkspaceActiveTimers(workspaceId, adminId) {
        // Verify admin has access
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can view team timers", 403);
        }
        // Get all running timers for this workspace
        const activeTimers = await TimeEntry.find({
            workspace: workspaceId,
            isRunning: true,
            isDeleted: false
        })
            .populate("user", "name email avatar")
            .populate("task", "title status priority")
            .populate("project", "name color")
            .sort("-startTime")
            .lean();
        // Calculate current duration for each timer
        const timersWithDuration = activeTimers.map((timer) => {
            const currentDuration = Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000);
            return {
                ...timer,
                currentDuration,
                currentDurationFormatted: this.formatDuration(currentDuration)
            };
        });
        return {
            workspace: {
                _id: workspace._id,
                name: workspace.name
            },
            activeTimerCount: timersWithDuration.length,
            activeTimers: timersWithDuration
        };
    }
    /**
     * Get team timesheets with aggregated data (Admin only)
     * Supports filtering by date range, user, and project
     */
    async getTeamTimesheets(workspaceId, adminId, filters) {
        // Verify admin has access
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can view team timesheets", 403);
        }
        // Build match query
        const matchQuery = {
            workspace: workspace._id,
            isDeleted: false,
            isRunning: false // Only completed entries
        };
        // Apply date filters
        if (filters.startDate || filters.endDate) {
            matchQuery.startTime = {};
            if (filters.startDate) {
                matchQuery.startTime.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                matchQuery.startTime.$lte = new Date(filters.endDate);
            }
        }
        // Apply user filter
        if (filters.userId) {
            matchQuery.user = filters.userId;
        }
        // Apply project filter
        if (filters.projectId) {
            matchQuery.project = filters.projectId;
        }
        // Aggregate by user
        const userSummary = await TimeEntry.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$user",
                    totalDuration: { $sum: "$duration" },
                    entryCount: { $sum: 1 },
                    projects: { $addToSet: "$project" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            {
                $unwind: "$userInfo"
            },
            {
                $project: {
                    user: {
                        _id: "$userInfo._id",
                        name: "$userInfo.name",
                        email: "$userInfo.email",
                        avatar: "$userInfo.avatar"
                    },
                    totalDuration: 1,
                    entryCount: 1,
                    projectCount: { $size: "$projects" }
                }
            },
            {
                $sort: { totalDuration: -1 }
            }
        ]);
        // Aggregate by project
        const projectSummary = await TimeEntry.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$project",
                    totalDuration: { $sum: "$duration" },
                    entryCount: { $sum: 1 },
                    users: { $addToSet: "$user" }
                }
            },
            {
                $lookup: {
                    from: "spaces",
                    localField: "_id",
                    foreignField: "_id",
                    as: "projectInfo"
                }
            },
            {
                $unwind: {
                    path: "$projectInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    project: {
                        _id: "$projectInfo._id",
                        name: "$projectInfo.name",
                        color: "$projectInfo.color"
                    },
                    totalDuration: 1,
                    entryCount: 1,
                    userCount: { $size: "$users" }
                }
            },
            {
                $sort: { totalDuration: -1 }
            }
        ]);
        // Calculate workspace total
        const workspaceTotal = userSummary.reduce((sum, item) => sum + item.totalDuration, 0);
        // Format durations
        userSummary.forEach((item) => {
            item.totalDurationFormatted = this.formatDuration(item.totalDuration);
        });
        projectSummary.forEach((item) => {
            item.totalDurationFormatted = this.formatDuration(item.totalDuration);
        });
        // Get detailed entries if specific user is selected
        let detailedEntries = null;
        if (filters.userId) {
            detailedEntries = await TimeEntry.find(matchQuery)
                .populate("task", "title status")
                .populate("project", "name color")
                .sort("-startTime")
                .limit(100)
                .lean();
            detailedEntries = detailedEntries.map((entry) => ({
                ...entry,
                durationFormatted: this.formatDuration(entry.duration || 0)
            }));
        }
        return {
            workspace: {
                _id: workspace._id,
                name: workspace.name
            },
            filters,
            summary: {
                totalDuration: workspaceTotal,
                totalDurationFormatted: this.formatDuration(workspaceTotal),
                totalUsers: userSummary.length,
                totalProjects: projectSummary.length
            },
            byUser: userSummary,
            byProject: projectSummary,
            detailedEntries
        };
    }
    /**
     * Admin force-stop a running timer (Admin only)
     * Useful when a user forgets to clock out
     */
    async adminStopTimer(entryId, adminId, reason) {
        const timeEntry = await TimeEntry.findOne({
            _id: entryId,
            isDeleted: false
        });
        if (!timeEntry) {
            throw new AppError("Time entry not found", 404);
        }
        // Verify timer is running
        if (!timeEntry.isRunning) {
            throw new AppError("This timer is not running", 400);
        }
        // Verify admin has access to this workspace
        const workspace = await Workspace.findOne({
            _id: timeEntry.workspace,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can stop team timers", 403);
        }
        // Stop timer
        timeEntry.endTime = new Date();
        timeEntry.isRunning = false;
        // Duration will be calculated by pre-save hook
        await timeEntry.save();
        // Populate for response
        await timeEntry.populate([
            { path: "task", select: "title status" },
            { path: "user", select: "name email" }
        ]);
        // Log activity
        try {
            await logger.logActivity({
                userId: adminId,
                workspaceId: timeEntry.workspace.toString(),
                action: "UPDATE",
                resourceType: "TimeEntry",
                resourceId: timeEntry._id.toString(),
                metadata: {
                    taskId: timeEntry.task?.toString(),
                    action: "admin_stopped_timer",
                    stoppedUserId: timeEntry.user.toString(),
                    duration: timeEntry.duration,
                    reason: reason || "Admin intervention"
                }
            });
        }
        catch (error) {
            // Silent fail - activity logging is non-critical
        }
        // Emit real-time event to notify the user
        try {
            if (timeEntry.task) {
                emitTaskEvent(timeEntry.task.toString(), "timer_stopped_by_admin", {
                    timeEntry: {
                        _id: timeEntry._id,
                        user: timeEntry.user,
                        startTime: timeEntry.startTime,
                        endTime: timeEntry.endTime,
                        duration: timeEntry.duration,
                        stoppedBy: adminId
                    }
                }, timeEntry.user.toString());
            }
        }
        catch (error) {
            // Silent fail - real-time events are non-critical
        }
        return timeEntry;
    }
    /**
     * Get workspace time tracking statistics (Admin only)
     * Provides overview metrics for the dashboard
     */
    async getWorkspaceTimeStats(workspaceId, adminId) {
        // Verify admin has access
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can view time statistics", 403);
        }
        // Get current active timers count
        const activeTimersCount = await TimeEntry.countDocuments({
            workspace: workspaceId,
            isRunning: true,
            isDeleted: false
        });
        // Get today's total time
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEntries = await TimeEntry.find({
            workspace: workspaceId,
            startTime: { $gte: todayStart },
            isDeleted: false,
            isRunning: false
        }).select("duration");
        const todayTotal = todayEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        // Get this week's total time
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEntries = await TimeEntry.find({
            workspace: workspaceId,
            startTime: { $gte: weekStart },
            isDeleted: false,
            isRunning: false
        }).select("duration");
        const weekTotal = weekEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        // Get this month's total time
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEntries = await TimeEntry.find({
            workspace: workspaceId,
            startTime: { $gte: monthStart },
            isDeleted: false,
            isRunning: false
        }).select("duration");
        const monthTotal = monthEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        // Get total entries count
        const totalEntriesCount = await TimeEntry.countDocuments({
            workspace: workspaceId,
            isDeleted: false
        });
        return {
            workspace: {
                _id: workspace._id,
                name: workspace.name
            },
            activeTimers: activeTimersCount,
            today: {
                totalDuration: todayTotal,
                totalDurationFormatted: this.formatDuration(todayTotal),
                entryCount: todayEntries.length
            },
            thisWeek: {
                totalDuration: weekTotal,
                totalDurationFormatted: this.formatDuration(weekTotal),
                entryCount: weekEntries.length
            },
            thisMonth: {
                totalDuration: monthTotal,
                totalDurationFormatted: this.formatDuration(monthTotal),
                entryCount: monthEntries.length
            },
            allTime: {
                entryCount: totalEntriesCount
            }
        };
    }
    /**
     * Cleanup orphaned timers (Admin only)
     * Stops all running timers that have been active for more than 24 hours
     */
    async cleanupOrphanedTimers(workspaceId, adminId) {
        // Verify admin has access
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can cleanup timers", 403);
        }
        // Find all running timers older than 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const orphanedTimers = await TimeEntry.find({
            workspace: workspaceId,
            isRunning: true,
            isDeleted: false,
            startTime: { $lt: twentyFourHoursAgo }
        });
        const stoppedTimers = [];
        for (const timer of orphanedTimers) {
            timer.endTime = new Date();
            timer.isRunning = false;
            await timer.save();
            stoppedTimers.push({
                _id: timer._id,
                user: timer.user,
                startTime: timer.startTime,
                duration: timer.duration
            });
            // Log activity
            try {
                await logger.logActivity({
                    userId: adminId,
                    workspaceId: workspaceId,
                    action: "UPDATE",
                    resourceType: "TimeEntry",
                    resourceId: timer._id.toString(),
                    metadata: {
                        action: "cleanup_orphaned_timer",
                        stoppedUserId: timer.user.toString(),
                        duration: timer.duration,
                        reason: "Automatic cleanup - timer running for more than 24 hours"
                    }
                });
            }
            catch (error) {
                // Silent fail
            }
        }
        return {
            message: `Cleaned up ${stoppedTimers.length} orphaned timers`,
            stoppedCount: stoppedTimers.length,
            stoppedTimers
        };
    }
    /**
     * Stop all running timers for a specific user (Admin only)
     * Useful when a user has multiple stuck timers
     */
    async stopAllUserTimers(workspaceId, userId, adminId, reason) {
        // Verify admin has access
        const workspace = await Workspace.findOne({
            _id: workspaceId,
            isDeleted: false
        });
        if (!workspace) {
            throw new AppError("Workspace not found", 404);
        }
        // Verify user is admin or owner
        const isOwner = workspace.owner.toString() === adminId;
        const member = workspace.members.find((m) => m.user.toString() === adminId);
        const isAdmin = member && (member.role === "admin" || member.role === "owner");
        if (!isOwner && !isAdmin) {
            throw new AppError("Only workspace admins can stop user timers", 403);
        }
        // Find all running timers for this user in this workspace
        const runningTimers = await TimeEntry.find({
            workspace: workspaceId,
            user: userId,
            isRunning: true,
            isDeleted: false
        });
        const stoppedTimers = [];
        for (const timer of runningTimers) {
            timer.endTime = new Date();
            timer.isRunning = false;
            await timer.save();
            stoppedTimers.push({
                _id: timer._id,
                startTime: timer.startTime,
                duration: timer.duration
            });
            // Log activity
            try {
                await logger.logActivity({
                    userId: adminId,
                    workspaceId: workspaceId,
                    action: "UPDATE",
                    resourceType: "TimeEntry",
                    resourceId: timer._id.toString(),
                    metadata: {
                        action: "admin_stopped_all_user_timers",
                        stoppedUserId: userId,
                        duration: timer.duration,
                        reason: reason || "Admin stopped all user timers"
                    }
                });
            }
            catch (error) {
                // Silent fail
            }
        }
        return {
            message: `Stopped ${stoppedTimers.length} timers for user`,
            stoppedCount: stoppedTimers.length,
            stoppedTimers
        };
    }
}
module.exports = new TimeEntryService();
