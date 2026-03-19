"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task = require("../models/Task");
const TimeEntry = require("../models/TimeEntry");
const AppError = require("../utils/AppError");
class PerformanceService {
    /**
     * Get user performance metrics for a workspace
     * @param userId - The user ID to calculate performance for
     * @param workspaceId - The workspace ID to scope the metrics
     * @returns Performance metrics including tasks finished, avg time, and success rate
     */
    async getUserPerformance(userId, workspaceId) {
        // 1. Get all tasks completed by this user in this workspace
        const completedTasks = await Task.find({
            workspace: workspaceId,
            completedBy: userId,
            status: "done",
            isDeleted: false
        }).select("_id completedAt deadline").lean();
        const totalTasksFinished = completedTasks.length;
        // If no tasks finished, return zeros
        if (totalTasksFinished === 0) {
            return {
                totalTasksFinished: 0,
                averageTimePerTask: 0,
                deadlineSuccessRate: 0,
                performanceNote: "No tasks completed yet. Start completing tasks to see your performance metrics!"
            };
        }
        // 2. Calculate Average Time Per Task
        // Get all time entries for these completed tasks
        const taskIds = completedTasks.map(t => t._id);
        const timeEntries = await TimeEntry.find({
            task: { $in: taskIds },
            user: userId,
            workspace: workspaceId,
            isDeleted: false,
            isRunning: false, // Only count stopped timers
            duration: { $exists: true, $gt: 0 }
        }).select("duration").lean();
        // Sum all durations (in seconds)
        const totalDuration = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        const averageTimePerTask = totalTasksFinished > 0 ? Math.round(totalDuration / totalTasksFinished) : 0;
        // 3. Calculate Deadline Success Rate
        // Count tasks where completedAt <= deadline
        let tasksWithDeadline = 0;
        let tasksMetDeadline = 0;
        for (const task of completedTasks) {
            if (task.deadline) {
                tasksWithDeadline++;
                if (task.completedAt && task.completedAt <= task.deadline) {
                    tasksMetDeadline++;
                }
            }
        }
        // Calculate success rate (only for tasks that have deadlines)
        const deadlineSuccessRate = tasksWithDeadline > 0
            ? Math.round((tasksMetDeadline / tasksWithDeadline) * 100)
            : 100; // If no deadlines set, consider it 100%
        // 4. Generate Performance Note
        const performanceNote = this.generatePerformanceNote(deadlineSuccessRate);
        return {
            totalTasksFinished,
            averageTimePerTask,
            deadlineSuccessRate,
            performanceNote
        };
    }
    /**
     * Generate performance note based on deadline success rate
     * @param successRate - The deadline success rate percentage
     * @returns A performance note string
     */
    generatePerformanceNote(successRate) {
        if (successRate > 80) {
            return "Excellent! You are consistently hitting deadlines and maintaining high reliability.";
        }
        else if (successRate >= 60) {
            return "Good effort, but improvement is needed in time management to ensure all tasks hit their targets.";
        }
        else {
            return "Action Required: Multiple deadlines missed. Please review workload and task priorities with your manager.";
        }
    }
    /**
     * Get team performance metrics for a workspace
     * Returns performance for all users in the workspace
     */
    async getTeamPerformance(workspaceId) {
        // Get all users who have completed tasks in this workspace
        const completedTasks = await Task.find({
            workspace: workspaceId,
            status: "done",
            completedBy: { $exists: true, $ne: null },
            isDeleted: false
        }).select("completedBy").lean();
        // Get unique user IDs
        const userIds = [...new Set(completedTasks.map(t => t.completedBy?.toString()).filter(Boolean))];
        // Get performance for each user
        const teamPerformance = await Promise.all(userIds.map(async (userId) => {
            const metrics = await this.getUserPerformance(userId, workspaceId);
            // Get user details
            const User = require("../models/User");
            const user = await User.findById(userId).select("name email avatar").lean();
            return {
                user: {
                    _id: userId,
                    name: user?.name || "Unknown User",
                    email: user?.email,
                    avatar: user?.avatar
                },
                metrics
            };
        }));
        // Sort by total tasks finished (descending)
        return teamPerformance.sort((a, b) => b.metrics.totalTasksFinished - a.metrics.totalTasksFinished);
    }
    /**
     * Get workspace-wide performance summary
     */
    async getWorkspacePerformanceSummary(workspaceId) {
        const completedTasks = await Task.find({
            workspace: workspaceId,
            status: "done",
            isDeleted: false
        }).select("completedAt deadline completedBy").lean();
        const totalCompleted = completedTasks.length;
        // Calculate overall deadline success rate
        let tasksWithDeadline = 0;
        let tasksMetDeadline = 0;
        for (const task of completedTasks) {
            if (task.deadline) {
                tasksWithDeadline++;
                if (task.completedAt && task.completedAt <= task.deadline) {
                    tasksMetDeadline++;
                }
            }
        }
        const overallSuccessRate = tasksWithDeadline > 0
            ? Math.round((tasksMetDeadline / tasksWithDeadline) * 100)
            : 100;
        // Get total time entries for completed tasks
        const taskIds = completedTasks.map(t => t._id);
        const timeEntries = await TimeEntry.find({
            task: { $in: taskIds },
            workspace: workspaceId,
            isDeleted: false,
            isRunning: false,
            duration: { $exists: true, $gt: 0 }
        }).select("duration").lean();
        const totalTimeSpent = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
        const averageTimePerTask = totalCompleted > 0 ? Math.round(totalTimeSpent / totalCompleted) : 0;
        // Count unique contributors
        const uniqueContributors = new Set(completedTasks.map(t => t.completedBy?.toString()).filter(Boolean)).size;
        return {
            totalCompleted,
            tasksWithDeadline,
            tasksMetDeadline,
            overallSuccessRate,
            averageTimePerTask,
            totalTimeSpent,
            uniqueContributors,
            performanceNote: this.generatePerformanceNote(overallSuccessRate)
        };
    }
}
module.exports = new PerformanceService();
