const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");

interface VelocityData {
  date: string;
  count: number;
}

interface LeadTimeData {
  averageLeadTime: number;
  unit: string;
  taskCount: number;
}

interface BurnDownData {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  completionRate: number;
}

interface ChartData {
  label: string;
  value: number;
}

interface WorkspaceOverview {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  priorityDistribution: ChartData[];
  statusDistribution: ChartData[];
  velocity: VelocityData[];
  leadTime: LeadTimeData;
}

interface TeamWorkload {
  userId: string;
  userName: string;
  userEmail: string;
  openTasks: number;
  inProgressTasks: number;
  totalAssignedTasks: number;
}

class AnalyticsService {
  /**
   * Calculate tasks completed per day over the last 30 days
   * GET /api/analytics/velocity
   */
  async getVelocity(workspaceId: string, userId: string, days: number = 30): Promise<VelocityData[]> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Calculate date range: from N days ago to end of today
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // MongoDB aggregation pipeline
    const velocityData = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          status: "done",
          isDeleted: false,
          completedAt: { $gte: startDate, $lte: endDate, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1
        }
      }
    ]);

    // Fill in missing dates with 0 count
    const filledData = this.fillMissingDates(velocityData, startDate, days);

    return filledData;
  }

  /**
   * Calculate average time from 'Created' to 'Done'
   * GET /api/analytics/lead-time
   */
  async getLeadTime(workspaceId: string, userId: string, days: number = 30): Promise<LeadTimeData> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // MongoDB aggregation pipeline
    const leadTimeData = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          status: "done",
          isDeleted: false,
          completedAt: { $gte: startDate, $ne: null }
        }
      },
      {
        $project: {
          leadTime: {
            $subtract: ["$completedAt", "$createdAt"]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageLeadTime: { $avg: "$leadTime" },
          taskCount: { $sum: 1 }
        }
      }
    ]);

    if (!leadTimeData || leadTimeData.length === 0) {
      return {
        averageLeadTime: 0,
        unit: "days",
        taskCount: 0
      };
    }

    // Convert milliseconds to days
    const avgLeadTimeMs = leadTimeData[0].averageLeadTime;
    const avgLeadTimeDays = avgLeadTimeMs / (1000 * 60 * 60 * 24);

    return {
      averageLeadTime: Math.round(avgLeadTimeDays * 10) / 10, // Round to 1 decimal
      unit: "days",
      taskCount: leadTimeData[0].taskCount
    };
  }

  /**
   * Get burn-down data: open vs completed tasks in a project
   * GET /api/analytics/burn-down
   */
  async getBurnDown(projectId: string, userId: string): Promise<BurnDownData> {
    // Get project and verify access
    const Space = require("../models/Space");
    const mongoose = require("mongoose");
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    
    const project = await Space.findOne({
      _id: projectObjectId,
      isDeleted: false
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(project.workspace.toString(), userId);

    // MongoDB aggregation pipeline
    const burnDownData = await Task.aggregate([
      {
        $match: {
          space: projectObjectId,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Process results
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let todo = 0;

    burnDownData.forEach((item: any) => {
      total += item.count;
      
      switch (item._id) {
        case "done":
          completed = item.count;
          break;
        case "in-progress":
          inProgress = item.count;
          break;
        case "todo":
          todo = item.count;
          break;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      todo,
      completionRate
    };
  }

  /**
   * Get comprehensive workspace overview
   * GET /api/workspaces/:workspaceId/analytics/summary
   */
  async getWorkspaceOverview(workspaceId: string, userId: string): Promise<WorkspaceOverview> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Single aggregation query to get all overview data
    const overviewData = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          isDeleted: false
        }
      },
      {
        $facet: {
          // Total and completed tasks
          taskCounts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "done"] }, 1, 0]
                  }
                }
              }
            }
          ],
          // Priority distribution
          priorityDistribution: [
            {
              $group: {
                _id: "$priority",
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                label: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$_id", "low"] }, then: "Low" },
                      { case: { $eq: ["$_id", "medium"] }, then: "Medium" },
                      { case: { $eq: ["$_id", "high"] }, then: "High" },
                      { case: { $eq: ["$_id", "urgent"] }, then: "Urgent" }
                    ],
                    default: "None"
                  }
                },
                value: "$count"
              }
            },
            {
              $sort: { value: -1 }
            }
          ],
          // Status distribution
          statusDistribution: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                label: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$_id", "todo"] }, then: "To Do" },
                      { case: { $eq: ["$_id", "in-progress"] }, then: "In Progress" },
                      { case: { $eq: ["$_id", "done"] }, then: "Done" }
                    ],
                    default: "Unknown"
                  }
                },
                value: "$count"
              }
            },
            {
              $sort: { value: -1 }
            }
          ]
        }
      }
    ]);

    // Get velocity for last 30 days (frontend will slice as needed)
    const velocity = await this.getVelocity(workspaceId, userId, 30);

    // Get lead time
    const leadTime = await this.getLeadTime(workspaceId, userId, 30);

    // Process results
    const taskCounts = overviewData[0].taskCounts[0] || { total: 0, completed: 0 };
    const completionRate = taskCounts.total > 0 
      ? Math.round((taskCounts.completed / taskCounts.total) * 100) 
      : 0;

    return {
      totalTasks: taskCounts.total,
      completedTasks: taskCounts.completed,
      completionRate,
      priorityDistribution: overviewData[0].priorityDistribution,
      statusDistribution: overviewData[0].statusDistribution,
      velocity,
      leadTime
    };
  }

  /**
   * Get team workload - open tasks grouped by assignee
   * GET /api/workspaces/:workspaceId/analytics/workload
   */
  async getTeamWorkload(workspaceId: string, userId: string): Promise<TeamWorkload[]> {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);

    // Aggregation with $lookup to get user details
    const workloadData = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          isDeleted: false,
          assignee: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$assignee",
          openTasks: {
            $sum: {
              $cond: [
                { $in: ["$status", ["todo", "in-progress"]] },
                1,
                0
              ]
            }
          },
          inProgressTasks: {
            $sum: {
              $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0]
            }
          },
          totalAssignedTasks: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          userName: { $ifNull: ["$userDetails.name", "Unknown User"] },
          userEmail: { $ifNull: ["$userDetails.email", ""] },
          openTasks: 1,
          inProgressTasks: 1,
          totalAssignedTasks: 1
        }
      },
      {
        $sort: { openTasks: -1 }
      }
    ]);

    return workloadData;
  }

  /**
   * Get comprehensive analytics for a workspace
   * GET /api/analytics/workspace/:workspaceId
   */
  async getWorkspaceAnalytics(workspaceId: string, userId: string) {
    // Verify user has access to workspace
    await this.verifyWorkspaceAccess(workspaceId, userId);

    // Get all analytics in parallel
    const [velocity, leadTime, statusDistribution, priorityDistribution] = await Promise.all([
      this.getVelocity(workspaceId, userId, 30),
      this.getLeadTime(workspaceId, userId, 30),
      this.getStatusDistribution(workspaceId),
      this.getPriorityDistribution(workspaceId)
    ]);

    return {
      velocity,
      leadTime,
      statusDistribution,
      priorityDistribution
    };
  }

  /**
   * Get status distribution for workspace
   */
  private async getStatusDistribution(workspaceId: string) {
    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    
    const distribution = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1
        }
      }
    ]);

    return distribution;
  }

  /**
   * Get priority distribution for workspace
   */
  private async getPriorityDistribution(workspaceId: string) {
    const mongoose = require("mongoose");
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    
    const distribution = await Task.aggregate([
      {
        $match: {
          workspace: workspaceObjectId,
          isDeleted: false
        }
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          priority: "$_id",
          count: 1
        }
      }
    ]);

    return distribution;
  }

  /**
   * Fill in missing dates with 0 count
   */
  private fillMissingDates(data: VelocityData[], startDate: Date, days: number): VelocityData[] {
    const filledData: VelocityData[] = [];
    const dataMap = new Map<string, number>();

    // Create map of existing data
    data.forEach(item => {
      dataMap.set(item.date, item.count);
    });

    // Fill in all dates from startDate to today (inclusive)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Stop if we've reached beyond today
      if (date > today) break;
      
      const dateStr = date.toISOString().split('T')[0];

      filledData.push({
        date: dateStr,
        count: dataMap.get(dateStr) || 0
      });
    }

    return filledData;
  }

  /**
   * Verify user has access to workspace
   */
  private async verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
    const mongoose = require("mongoose");
    
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this workspace", 403);
    }
  }
}

module.exports = new AnalyticsService();

export {};
