const Workspace = require("../models/Workspace");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

export const getCapabilities = async (workspaceId: string, actorId: string, listId?: string, projectId?: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  let list: any;
  if (listId) {
    list = await List.findOne({ _id: listId, workspace: workspaceId, isDeleted: false });
    if (!list) throw new AppError("List not found", 404);
  }
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const context = { workspaceId, userId: actorId, ...(scope.project.space && { spaceId: scope.project.space.toString() }), ...(scope.project.folder && { folderId: scope.project.folder.toString() }), ...(list && { listId, spaceId: list.space.toString() }) };
  const actions = ["QA_VIEW", "QA_MANAGE_CASES", "QA_EXECUTE", "QA_CREATE_BUG", "QA_TRIAGE_BUG", "QA_VERIFY_BUG", "QA_MANAGE_RELEASES", "QA_SIGN_OFF"];
  const [canViewList, ...values] = await Promise.all([
    list ? PermissionService.can(actorId, "VIEW_LIST", context) : Promise.resolve(true),
    ...actions.map(action => PermissionService.can(actorId, action, context)),
  ]);
  const allowed = Object.fromEntries(actions.map((action, index) => [action, Boolean(values[index])]));
  const enabled = Boolean(workspace.qualityEnabled);
  return {
    qualityEnabled: enabled,
    canViewQuality: enabled && Boolean(allowed.QA_VIEW),
    canAuthorCase: enabled && Boolean(allowed.QA_MANAGE_CASES),
    canExecuteCase: enabled && Boolean(allowed.QA_EXECUTE),
    canManagePlan: enabled && Boolean(allowed.QA_MANAGE_RELEASES),
    canCreateBug: enabled && Boolean(canViewList) && Boolean(allowed.QA_CREATE_BUG),
    canTriageBug: enabled && Boolean(canViewList) && Boolean(allowed.QA_TRIAGE_BUG),
    canVerifyBug: enabled && Boolean(canViewList) && Boolean(allowed.QA_VERIFY_BUG),
    canViewReport: enabled && Boolean(allowed.QA_MANAGE_RELEASES),
    canSignOff: enabled && Boolean(allowed.QA_SIGN_OFF),
  };
};
