type DashboardAnalytics = Record<string, any>;

const countByLabel = (values: Array<{ label?: string; value?: number }> = []) =>
  values.reduce<Record<string, number>>((result, item) => {
    if (item?.label) result[item.label] = Number(item.value || 0);
    return result;
  }, {});

const userIdOf = (value: any): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.id?.toString?.() || "";
};

/** Shapes analytics into the compact contract consumed by the mobile dashboard. */
function buildMobileDashboardPayload(
  analytics: DashboardAnalytics,
  options: { workspaceId: string; userId: string; from?: string; to?: string; timezone?: string }
) {
  const stats = analytics.stats || {};
  const view = analytics.view || {};
  const members = analytics.members || [];
  const allTasks = analytics.tasks || [];
  const taskStatus = countByLabel(stats.statusDistribution || []);
  const priorityCounts = countByLabel(stats.priorityDistribution || []);
  const assignedTasks = allTasks
    .filter((task: any) => userIdOf(task.assignee) === options.userId)
    .map((task: any) => ({
      _id: task._id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      workItemType: task.workItemType || "task",
      list: task.list,
      space: task.space,
      workspace: options.workspaceId,
      assignee: { _id: userIdOf(task.assignee) },
      dueDate: task.deadline || task.dueDate || null,
      completedAt: task.completedAt || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));
  const toAvailabilityMember = (member: any) => ({
    user: {
      _id: member.user?._id,
      name: member.user?.name || "Unknown User",
      profilePicture: member.user?.profilePicture || member.user?.avatar || null
    },
    role: member.role || "member",
    status: member.status || "inactive"
  });
  const liveNow = members
    .filter((member: any) => member.status === "active")
    .map(toAvailabilityMember);
  const clockedOut = members
    .filter((member: any) => member.status !== "active")
    .map(toAvailabilityMember);
  const analyticsView = {
    requested: view.requested || null,
    effective: view.effective || "personal",
    available: view.available || ["personal"],
    canViewWorkspaceAnalytics: view.canViewWorkspaceAnalytics === true,
    canViewPersonalAnalytics: view.canViewPersonalAnalytics === true
  };

  return {
    summary: {
      version: "v2",
      scope: {
        workspaceId: options.workspaceId,
        timezone: options.timezone || "UTC",
        from: options.from || null,
        to: options.to || null,
        view: analyticsView
      },
      summary: {
        totalTeam: members.length,
        clockedIn: liveNow.length,
        totalTasks: Number(stats.totalTasks || 0),
        completedTasks: Number(stats.completedTasks || 0),
        onTimeCompletionRate: Number(stats.deadlineCompletionRate ?? 100),
        activeProjects: (analytics.hierarchy || []).length
      },
      timeTracking: {
        currentRunningTimer: analytics.currentRunningTimer || null,
        summary: analytics.timeTrackingSummary || {}
      },
      taskStatus: {
        totalTasks: Number(stats.totalTasks || 0),
        completed: Number(stats.completedTasks || 0),
        inProgress: Number(taskStatus["In Progress"] || 0),
        delayed: Number(stats.delayedOpenTasks || 0),
        distribution: stats.statusDistribution || []
      },
      priorityDistribution: {
        high: Number(priorityCounts.High || 0),
        medium: Number(priorityCounts.Medium || 0),
        low: Number(priorityCounts.Low || 0),
        urgent: Number(priorityCounts.Urgent || 0)
      },
      teamAvailability: { liveNow, clockedOut, total: members.length },
      permissions: analytics.permissions || {}
    },
    details: {
      workspace: analytics.workspace || null,
      tasks: assignedTasks,
      announcements: analytics.announcements || [],
      recentActivity: analytics.recentActivity || [],
      performance: { user: analytics.performance?.user || null, team: [] },
      view: analyticsView,
      permissions: analytics.permissions || {}
    }
  };
}

module.exports = { buildMobileDashboardPayload };
export {};
