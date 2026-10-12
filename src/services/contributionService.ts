const WorkspaceActivity = require("../models/WorkspaceActivity");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const mongoose = require("mongoose");
const { subDays, format } = require("date-fns");

class ContributionService {
  /**
   * Get daily contribution counts for a user over a period
   */
  async getDailyContributions(userId, workspaceId, type = "all") {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const workspaceFilter = workspaceId && mongoose.Types.ObjectId.isValid(workspaceId)
      ? { workspace: new mongoose.Types.ObjectId(workspaceId) }
      : {};

    const aggregateDailyCounts = (model, match, dateField) => model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: `$${dateField}`,
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const includeGithub = type === "all" || type === "github";
    const includeTasks = type === "all" || type === "tasks";
    const [commitDays, completedTaskDays, taskActivityDays] = await Promise.all([
      includeGithub
        ? aggregateDailyCounts(
            WorkspaceActivity,
            { user: userObjectId, type: "github_commit", ...workspaceFilter },
            "createdAt",
          )
        : [],
      includeTasks
        ? aggregateDailyCounts(
            Task,
            { completedBy: userObjectId, status: "done", completedAt: { $type: "date" }, ...workspaceFilter },
            "completedAt",
          )
        : [],
      includeTasks
        ? aggregateDailyCounts(
            Activity,
            { user: userObjectId, isDeleted: false, ...workspaceFilter },
            "createdAt",
          )
        : [],
    ]);

    const contributions = {};
    for (const day of [...commitDays, ...completedTaskDays, ...taskActivityDays]) {
      if (!day._id) continue;
      contributions[day._id] = (contributions[day._id] || 0) + day.count;
    }

    const streakData = this.calculateStreaks(contributions);
    return {
      dailyCounts: contributions,
      ...streakData,
    };
  }

  /**
   * Calculate current and longest streaks from a date map
   */
  calculateStreaks(contributions) {
    const dates = Object.keys(contributions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    
    // Check if streak is still active (activity today or yesterday)
    let isStreakActive = contributions[today] || contributions[yesterday];
    
    if (!isStreakActive) {
      currentStreak = 0;
    } else {
      // Calculate current streak
      let checkDate = contributions[today] ? new Date() : subDays(new Date(), 1);
      while (contributions[format(checkDate, "yyyy-MM-dd")]) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    // Calculate longest streak
    const sortedDates = Object.keys(contributions).sort();
    if (sortedDates.length > 0) {
      let prevDate = new Date(sortedDates[0]);
      let tempStreak = 1;
      longestStreak = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const currDate = new Date(sortedDates[i]);
        const diffInDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 1) {
          tempStreak++;
        } else if (diffInDays > 1) {
          tempStreak = 1;
        }
        
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        prevDate = currDate;
      }
    }

    return { currentStreak, longestStreak };
  }
  /**
   * Get raw performance statistics for a user
   */
  async getUserPerformanceStats(userId, workspaceId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // 1. Fetch ALL tasks relevant to the user (assigned, completed, or created)
    const query: any = {
      $or: [
        { assignee: userObjectId },
        { assigneeId: userObjectId },
        { completedBy: userObjectId }
      ],
      isDeleted: false
    };

    if (workspaceId && mongoose.Types.ObjectId.isValid(workspaceId)) {
      query.workspace = new mongoose.Types.ObjectId(workspaceId);
    }

    const allTasks = await Task.find(query).lean();

    // 2. Fetch only COMPLETED tasks for completion rate calculation
    const doneTasks = allTasks.filter(t => t.status === "done");

    const stats = {
      tasksDone: doneTasks.length,
      onTimeCompletions: 0,
      totalWithDeadlines: 0,
      completionRate: 100, // Default to 100% if no deadlines
      priorityDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      }
    };

    // Calculate priority distribution from ALL assigned tasks
    allTasks.forEach(task => {
      const priority = task.priority || "medium";
      if (stats.priorityDistribution[priority] !== undefined) {
        stats.priorityDistribution[priority]++;
      }
    });

    // Calculate deadline completion rate from DONE tasks
    doneTasks.forEach(task => {
      // Use 'deadline' as primary, fallback to 'dueDate'
      const targetDeadline = task.deadline || task.dueDate;
      
      if (targetDeadline) {
        stats.totalWithDeadlines++;
        // Compare completion date with deadline
        if (task.completedAt && new Date(task.completedAt) <= new Date(targetDeadline)) {
          stats.onTimeCompletions++;
        }
      }
    });

    // Calculate completion rate percentage
    if (stats.totalWithDeadlines > 0) {
      stats.completionRate = Math.round((stats.onTimeCompletions / stats.totalWithDeadlines) * 100);
    } else {
      stats.completionRate = 100; // Match dashboard logic: 100% if no deadlines
    }

    return stats;
  }
}

module.exports = new ContributionService();
