const Task = require("../models/Task");
const List = require("../models/List");
const TimeEntry = require("../models/TimeEntry");
const WorkspaceActivity = require("../models/WorkspaceActivity");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const mongoose = require("mongoose");

interface PerformanceMetrics {
  totalTasksFinished: number;
  completionRate: number | null; // percentage of assigned active tasks completed
  assignedTasksTotal: number;
  assignedTasksDone: number;
  averageTimePerTask: number; // in seconds
  deadlineSuccessRate: number; // percentage
  tasksWithDeadline: number;
  tasksMetDeadline: number;
  delayedOpenTasks: number;
  completedLateTasks: number;
  totalDelayedTasks: number;
  performanceNote: string;
}

class PerformanceService {
  private buildDateRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | null {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    return Object.keys(range).length > 0 ? range : null;
  }
  /**
   * Get user performance metrics for a workspace
   * @param userId - The user ID to calculate performance for
   * @param workspaceId - The workspace ID to scope the metrics
   * @returns Performance metrics including tasks finished, avg time, and success rate
   */
  async getUserPerformance(
    userId: string,
    workspaceId: string,
    period?: { from?: string; to?: string }
  ): Promise<PerformanceMetrics> {
    const activeLists = await List.find({
      workspace: workspaceId,
      isDeleted: false
    }).select("_id").lean();
    const activeListIds = activeLists.map((l: any) => l._id);

    const completedAtRange = this.buildDateRange(period?.from, period?.to);
    const createdAtRange = this.buildDateRange(period?.from, period?.to);

    // 1) Contribution-based completed tasks (for "Tasks Finished"):
    // A task counts if the user is assignee OR completedBy.
    const contributionCompletedQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      status: "done",
      $or: [{ assignee: userId }, { completedBy: userId }],
      isDeleted: false
    };
    if (completedAtRange) contributionCompletedQuery.completedAt = completedAtRange;

    const contributionCompletedTasks = await Task.find(contributionCompletedQuery).select("_id completedAt deadline").lean();

    const totalTasksFinished = contributionCompletedTasks.length;

    // 2) Assignment-based completed tasks (for completion accountability)
    const assignedCompletedQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      assignee: userId,
      status: "done",
      isDeleted: false
    };
    if (completedAtRange) assignedCompletedQuery.completedAt = completedAtRange;
    const assignedCompletedTasksCount = await Task.countDocuments(assignedCompletedQuery);

    const assignedTotalQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      assignee: userId,
      isDeleted: false,
      status: { $ne: "cancelled" }
    };
    if (createdAtRange) assignedTotalQuery.createdAt = createdAtRange;
    const totalAssignedActiveTasks = await Task.countDocuments(assignedTotalQuery);

    const completionRate = totalAssignedActiveTasks > 0
      ? Math.round((assignedCompletedTasksCount / totalAssignedActiveTasks) * 100)
      : null;

    // If no tasks finished, return zeros
    if (totalTasksFinished === 0) {
      const delayedOpenQuery: any = {
        workspace: workspaceId,
        list: { $in: activeListIds },
        assignee: userId,
        isDeleted: false,
        status: { $nin: ["done", "cancelled"] },
        deadline: { $lt: new Date() }
      };
      if (createdAtRange) delayedOpenQuery.createdAt = createdAtRange;
      const delayedOpenTasks = await Task.countDocuments(delayedOpenQuery);
      return {
        totalTasksFinished: 0,
        completionRate,
        assignedTasksTotal: totalAssignedActiveTasks,
        assignedTasksDone: assignedCompletedTasksCount,
        averageTimePerTask: 0,
        deadlineSuccessRate: 0,
        tasksWithDeadline: 0,
        tasksMetDeadline: 0,
        delayedOpenTasks,
        completedLateTasks: 0,
        totalDelayedTasks: delayedOpenTasks,
        performanceNote: "No tasks completed yet. Start completing tasks to see your performance metrics!"
      };
    }

    // 2. Calculate Average Time Per Task
    // Get all time entries for these completed tasks
    const taskIds = contributionCompletedTasks.map(t => t._id);
    
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

    for (const task of contributionCompletedTasks) {
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

    const delayedOpenQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      assignee: userId,
      isDeleted: false,
      status: { $nin: ["done", "cancelled"] },
      deadline: { $lt: new Date() }
    };
    if (createdAtRange) delayedOpenQuery.createdAt = createdAtRange;
    const delayedOpenTasks = await Task.countDocuments(delayedOpenQuery);

    const completedLateQuery: any = {
      workspace: workspaceId,
      list: { $in: activeListIds },
      $or: [{ assignee: userId }, { completedBy: userId }],
      isDeleted: false,
      status: "done",
      deadline: { $exists: true, $ne: null },
      $expr: { $gt: ["$completedAt", "$deadline"] }
    };
    if (completedAtRange) completedLateQuery.completedAt = completedAtRange;
    const completedLateTasks = await Task.countDocuments(completedLateQuery);
    const totalDelayedTasks = delayedOpenTasks + completedLateTasks;

    // 4. Generate Performance Note
    const performanceNote = this.generatePerformanceNote(deadlineSuccessRate);

    return {
      totalTasksFinished,
      completionRate,
      assignedTasksTotal: totalAssignedActiveTasks,
      assignedTasksDone: assignedCompletedTasksCount,
      averageTimePerTask,
      deadlineSuccessRate,
      tasksWithDeadline,
      tasksMetDeadline,
      delayedOpenTasks,
      completedLateTasks,
      totalDelayedTasks,
      performanceNote
    };
  }

  /**
   * Generate performance note based on deadline success rate
   * @param successRate - The deadline success rate percentage
   * @returns A performance note string
   */
  private generatePerformanceNote(successRate: number): string {
    if (successRate > 80) {
      return "Excellent! You are consistently hitting deadlines and maintaining high reliability.";
    } else if (successRate >= 60) {
      return "Good effort, but improvement is needed in time management to ensure all tasks hit their targets.";
    } else {
      return "Action Required: Multiple deadlines missed. Please review workload and task priorities with your manager.";
    }
  }

  /**
   * Get team performance metrics for a workspace
   * Returns performance for all users in the workspace
   */
  async getTeamPerformance(workspaceId: string, period?: { from?: string; to?: string }): Promise<any[]> {
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    const activeLists = await List.find({
      workspace: workspaceId,
      isDeleted: false
    }).select("_id").lean();
    const activeListIds = activeLists.map((l: any) => l._id);
    const completedAtRange = this.buildDateRange(period?.from, period?.to);
    const createdAtRange = this.buildDateRange(period?.from, period?.to);
    const overdueNow = new Date();

    const contributionMatch: any = {
      workspace: workspaceObjectId,
      list: { $in: activeListIds },
      status: "done",
      isDeleted: false
    };
    if (completedAtRange) contributionMatch.completedAt = completedAtRange;

    const assignedMatch: any = {
      workspace: workspaceObjectId,
      list: { $in: activeListIds },
      isDeleted: false,
      assignee: { $exists: true, $ne: null },
      status: { $ne: "cancelled" }
    };
    if (createdAtRange) assignedMatch.createdAt = createdAtRange;

    const delayedOpenMatch: any = {
      workspace: workspaceObjectId,
      list: { $in: activeListIds },
      isDeleted: false,
      assignee: { $exists: true, $ne: null },
      status: { $nin: ["done", "cancelled"] },
      deadline: { $lt: overdueNow }
    };
    if (createdAtRange) delayedOpenMatch.createdAt = createdAtRange;

    const contributionStats = await Task.aggregate([
      { $match: contributionMatch },
      {
        $project: {
          deadline: 1,
          completedAt: 1,
          contributors: {
            $setUnion: [
              { $cond: [{ $ifNull: ["$assignee", false] }, ["$assignee"], []] },
              { $cond: [{ $ifNull: ["$completedBy", false] }, ["$completedBy"], []] }
            ]
          }
        }
      },
      { $unwind: "$contributors" },
      {
        $group: {
          _id: "$contributors",
          totalTasksFinished: { $sum: 1 },
          tasksWithDeadline: {
            $sum: {
              $cond: [{ $ifNull: ["$deadline", false] }, 1, 0]
            }
          },
          tasksMetDeadline: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$deadline", false] },
                    { $ifNull: ["$completedAt", false] },
                    { $lte: ["$completedAt", "$deadline"] }
                  ]
                },
                1,
                0
              ]
            }
          },
          completedLateTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$deadline", false] },
                    { $ifNull: ["$completedAt", false] },
                    { $gt: ["$completedAt", "$deadline"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const assignedStats = await Task.aggregate([
      { $match: assignedMatch },
      {
        $group: {
          _id: "$assignee",
          assignedTasksTotal: { $sum: 1 },
          assignedTasksDone: {
            $sum: {
              $cond: [{ $eq: ["$status", "done"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const delayedOpenStats = await Task.aggregate([
      { $match: delayedOpenMatch },
      {
        $group: {
          _id: "$assignee",
          delayedOpenTasks: { $sum: 1 }
        }
      }
    ]);

    const timeEntryTaskMatch: any = {
      "taskDoc.workspace": workspaceObjectId,
      "taskDoc.list": { $in: activeListIds },
      "taskDoc.status": "done",
      "taskDoc.isDeleted": false
    };
    if (completedAtRange) timeEntryTaskMatch["taskDoc.completedAt"] = completedAtRange;

    const timeEntryStats = await TimeEntry.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          isDeleted: false,
          isRunning: false,
          duration: { $exists: true, $gt: 0 }
        }
      },
      {
        $lookup: {
          from: "tasks",
          localField: "task",
          foreignField: "_id",
          as: "taskDoc"
        }
      },
      { $unwind: "$taskDoc" },
      { $match: timeEntryTaskMatch },
      {
        $group: {
          _id: "$user",
          totalDuration: { $sum: "$duration" }
        }
      }
    ]);

    const contributionByUser = new Map(contributionStats.map((row: any) => [row._id.toString(), row]));
    const assignedByUser = new Map(assignedStats.map((row: any) => [row._id.toString(), row]));
    const delayedByUser = new Map(delayedOpenStats.map((row: any) => [row._id.toString(), row]));
    const timeByUser = new Map(timeEntryStats.map((row: any) => [row._id.toString(), row]));

    const userIds = Array.from(
      new Set([
        ...contributionByUser.keys(),
        ...assignedByUser.keys(),
        ...delayedByUser.keys(),
        ...timeByUser.keys()
      ])
    );

    if (userIds.length === 0) {
      return [];
    }

    const users = await User.find({ _id: { $in: userIds } })
      .select("name email avatar profilePicture")
      .lean();
    const usersById = new Map(users.map((user: any) => [user._id.toString(), user]));

    const teamPerformance = userIds.map((userId) => {
      const contribution = contributionByUser.get(userId);
      const assigned = assignedByUser.get(userId);
      const delayed = delayedByUser.get(userId);
      const time = timeByUser.get(userId);
      const totalTasksFinished = contribution?.totalTasksFinished || 0;
      const assignedTasksTotal = assigned?.assignedTasksTotal || 0;
      const assignedTasksDone = assigned?.assignedTasksDone || 0;
      const completionRate = assignedTasksTotal > 0
        ? Math.round((assignedTasksDone / assignedTasksTotal) * 100)
        : null;
      const tasksWithDeadline = contribution?.tasksWithDeadline || 0;
      const tasksMetDeadline = contribution?.tasksMetDeadline || 0;
      const deadlineSuccessRate = totalTasksFinished === 0
        ? 0
        : tasksWithDeadline > 0
          ? Math.round((tasksMetDeadline / tasksWithDeadline) * 100)
          : 100;
      const delayedOpenTasks = delayed?.delayedOpenTasks || 0;
      const completedLateTasks = contribution?.completedLateTasks || 0;
      const totalDelayedTasks = delayedOpenTasks + completedLateTasks;
      const averageTimePerTask = totalTasksFinished > 0
        ? Math.round((time?.totalDuration || 0) / totalTasksFinished)
        : 0;
      const user = usersById.get(userId);

      return {
        user: {
          _id: userId,
          name: user?.name || "Unknown User",
          email: user?.email || "",
          avatar: user?.avatar,
          profilePicture: user?.profilePicture
        },
        metrics: {
          totalTasksFinished,
          completionRate,
          assignedTasksTotal,
          assignedTasksDone,
          averageTimePerTask,
          deadlineSuccessRate,
          tasksWithDeadline,
          tasksMetDeadline,
          delayedOpenTasks,
          completedLateTasks,
          totalDelayedTasks,
          performanceNote: totalTasksFinished === 0
            ? "No tasks completed yet. Start completing tasks to see your performance metrics!"
            : this.generatePerformanceNote(deadlineSuccessRate)
        }
      };
    });

    return teamPerformance.sort((a, b) => {
      if (b.metrics.totalTasksFinished !== a.metrics.totalTasksFinished) {
        return b.metrics.totalTasksFinished - a.metrics.totalTasksFinished;
      }
      return (b.metrics.deadlineSuccessRate || 0) - (a.metrics.deadlineSuccessRate || 0);
    });
  }

  /**
   * Get workspace-wide performance summary
   */
  async getWorkspacePerformanceSummary(workspaceId: string): Promise<any> {
    const activeLists = await List.find({
      workspace: workspaceId,
      isDeleted: false
    }).select("_id").lean();
    const activeListIds = activeLists.map((l: any) => l._id);

    const completedTasks = await Task.find({
      workspace: workspaceId,
      list: { $in: activeListIds },
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
    const uniqueContributors = new Set(
      completedTasks.map(t => t.completedBy?.toString()).filter(Boolean)
    ).size;

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

  /**
   * Get deep performance details for a specific user in a workspace
   */
  async getUserPerformanceDetails(
    userId: string,
    workspaceId: string,
    limit: number = 100,
    period?: { from?: string; to?: string }
  ): Promise<any> {
    const metrics = await this.getUserPerformance(userId, workspaceId, period);

    const safeLimit = Math.min(Math.max(limit || 100, 1), 500);
    const completedAtRange = this.buildDateRange(period?.from, period?.to);
    const createdAtRange = this.buildDateRange(period?.from, period?.to);

    const user = await User.findById(userId).select("name email avatar profilePicture").lean();

    const taskQuery: any = {
      workspace: workspaceId,
      isDeleted: false,
      $or: [{ assignee: userId }, { completedBy: userId }, { createdBy: userId }]
    };
    if (createdAtRange) taskQuery.createdAt = createdAtRange;

    const taskDocs = await Task.find(taskQuery)
      .select("_id title status priority deadline dueDate createdAt updatedAt completedAt assignee completedBy list space")
      .populate("list", "name")
      .populate("space", "name")
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    const now = new Date();
    const taskHistory = taskDocs.map((task: any) => {
      const targetDeadline = task.deadline || task.dueDate || null;
      const completedAt = task.completedAt || null;
      const isDone = task.status === "done";
      const isOpen = !["done", "cancelled"].includes(task.status);
      const isDelayedOpen = !!(isOpen && targetDeadline && new Date(targetDeadline) < now);
      const isCompletedLate = !!(isDone && targetDeadline && completedAt && new Date(completedAt) > new Date(targetDeadline));

      return {
        _id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority || "medium",
        deadline: task.deadline || null,
        dueDate: task.dueDate || null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt || null,
        list: task.list ? { _id: task.list._id, name: task.list.name } : null,
        space: task.space ? { _id: task.space._id, name: task.space.name } : null,
        isDelayedOpen,
        isCompletedLate
      };
    });

    const commitQuery: any = {
      workspace: workspaceId,
      user: userId,
      type: "github_commit",
      isDeleted: false
    };
    if (createdAtRange) commitQuery.createdAt = createdAtRange;

    const commitActivities = await WorkspaceActivity.find(commitQuery)
      .select("_id description metadata createdAt")
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean();

    const commits = commitActivities.map((entry: any) => ({
      _id: entry._id,
      description: entry.description,
      createdAt: entry.createdAt,
      metadata: entry.metadata || {}
    }));

    return {
      user: user || { _id: userId, name: "Unknown User", email: "" },
      metrics,
      taskHistory,
      commits
    };
  }
}

module.exports = new PerformanceService();
export {};
