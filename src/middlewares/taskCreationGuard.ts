import { Request, Response, NextFunction } from "express";

const { requirePermission } = require("../permissions/permission.middleware");
const { checkTaskLimit } = require("./subscriptionMiddleware");

export const authorizeTaskCreation = (req: Request, res: Response, next: NextFunction) => {
  if (req.body?.workItemType === "bug") {
    return requirePermission("VIEW_LIST")(req, res, (error: any) => {
      if (error) return next(error);
      return requirePermission("CREATE_BUG")(req, res, next);
    });
  }

  return checkTaskLimit(req, res, (error: any) => {
    if (error) return next(error);
    return requirePermission("CREATE_TASK")(req, res, next);
  });
};
