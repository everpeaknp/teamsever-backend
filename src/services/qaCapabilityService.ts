const Workspace = require("../models/Workspace");
const List = require("../models/List");
const PermissionService = require("../permissions/permission.service");
const AppError = require("../utils/AppError");

export const getCapabilities = async (workspaceId: string, actorId: string, listId?: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false });
  if (!workspace) throw new AppError("Workspace not found", 404);
  let list: any;
  if (listId) {
    list = await List.findOne({ _id: listId, workspace: workspaceId, isDeleted: false });
    if (!list) throw new AppError("List not found", 404);
  }
  const context = { workspaceId, userId: actorId, ...(list && { listId, spaceId: list.space.toString() }) };
  const actions = ["VIEW_QUALITY", "AUTHOR_CASE", "EXECUTE_CASE", "MANAGE_PLAN", "CREATE_BUG", "TRIAGE_BUG", "VERIFY_BUG", "VIEW_QA_REPORT", "SIGN_OFF_QA"];
  const [canViewList, ...values] = await Promise.all([
    list ? PermissionService.can(actorId, "VIEW_LIST", context) : Promise.resolve(true),
    ...actions.map(action => PermissionService.can(actorId, action, context)),
  ]);
  const allowed = Object.fromEntries(actions.map((action, index) => [action, Boolean(values[index])]));
  const enabled = Boolean(workspace.qualityEnabled);
  return {
    qualityEnabled: enabled,
    canViewQuality: enabled && Boolean(allowed.VIEW_QUALITY),
    canAuthorCase: enabled && Boolean(allowed.AUTHOR_CASE),
    canExecuteCase: enabled && Boolean(allowed.EXECUTE_CASE),
    canManagePlan: enabled && Boolean(allowed.MANAGE_PLAN),
    canCreateBug: enabled && Boolean(canViewList) && Boolean(allowed.CREATE_BUG),
    canTriageBug: enabled && Boolean(canViewList) && Boolean(allowed.TRIAGE_BUG),
    canVerifyBug: enabled && Boolean(canViewList) && Boolean(allowed.VERIFY_BUG),
    canViewReport: enabled && Boolean(allowed.VIEW_QA_REPORT),
    canSignOff: enabled && Boolean(allowed.SIGN_OFF_QA),
  };
};
