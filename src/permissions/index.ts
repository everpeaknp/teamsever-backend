/**
 * Permission System - Central Export
 * Import everything you need from here
 */

export * from "./permission.types";
export * from "./permission.constants";

const PermissionService = require("./permission.service");
const { requirePermission } = require("./permission.middleware");

module.exports = {
  PermissionService,
  requirePermission,
};
