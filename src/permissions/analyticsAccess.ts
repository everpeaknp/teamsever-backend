export type AnalyticsView = "workspace" | "personal";

interface ResolveAnalyticsViewInput {
  requestedView?: string;
  canViewPersonalAnalytics: boolean;
  canViewTeamAnalytics: boolean;
}

interface ResolveAnalyticsViewResult {
  effectiveView: AnalyticsView;
  availableViews: AnalyticsView[];
}

export function resolveAnalyticsViewAccess(
  input: ResolveAnalyticsViewInput
): ResolveAnalyticsViewResult {
  const { requestedView, canViewPersonalAnalytics, canViewTeamAnalytics } = input;

  if (!canViewPersonalAnalytics && !canViewTeamAnalytics) {
    throw new Error("ANALYTICS_PERMISSION_DENIED");
  }

  const normalizedView = requestedView === "personal" || requestedView === "workspace"
    ? requestedView
    : undefined;

  const canUseWorkspaceView = canViewTeamAnalytics;
  const effectiveView: AnalyticsView =
    normalizedView === "personal"
      ? "personal"
      : (normalizedView === "workspace" ? (canUseWorkspaceView ? "workspace" : "personal") : (canUseWorkspaceView ? "workspace" : "personal"));

  return {
    effectiveView,
    availableViews: canUseWorkspaceView ? ["workspace", "personal"] : ["personal"]
  };
}

