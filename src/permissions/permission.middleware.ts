/**
 * Permission Middleware
 * Centralized middleware for route-level permission checking
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";
import { PermissionContext, PermissionAction } from "./permission.types";

const PermissionService = require("./permission.service");
const AppError = require("../utils/AppError");
const Space = require("../models/Space");
const List = require("../models/List");
const Task = require("../models/Task");
const Folder = require("../models/Folder");

/**
 * Middleware to check if user has permission to perform an action
 * @param action - The permission action to check
 * @returns Express middleware function
 */
const requirePermission = (action: PermissionAction) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log('\n🚀 MIDDLEWARE: requirePermission called');
      console.log('  ➜ Action:', action);
      console.log('  ➜ Method:', req.method);
      console.log('  ➜ Path:', req.path);
      console.log('  ➜ BaseURL:', req.baseUrl);
      
      const userId = req.user?.id;
      console.log('  ➜ User ID:', userId);

      if (!userId) {
        return next(new AppError("Authentication required", 401));
      }

      // Get workspace ID from request
      const workspaceId = await getWorkspaceId(req);
      console.log('  ➜ Workspace ID:', workspaceId);

      if (!workspaceId) {
        return next(new AppError("Workspace context not found", 400));
      }

      // Build permission context
      const context: PermissionContext = {
        userId,
        workspaceId,
        spaceId: await getSpaceId(req),
        folderId: await getFolderId(req),
        listId: await getListId(req),
        resourceId: getResourceId(req),
        resourceType: getResourceType(req),
      };
      
      console.log('  ➜ Context built:', JSON.stringify(context, null, 2));

      // Check permission
      const hasPermission = await PermissionService.can(userId, action, context);
      
      console.log('  ➜ Permission result:', hasPermission);

      if (!hasPermission) {
        console.log('  ❌ Permission denied, returning 403');
        return next(
          new AppError(
            `You do not have permission to perform this action: ${action}`,
            403
          )
        );
      }
      
      console.log('  ✅ Permission granted, continuing...\n');

      // Attach context to request for use in controllers
      (req as any).permissionContext = context;

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Get space ID from request params or related resources
 */
async function getSpaceId(req: AuthRequest): Promise<string | undefined> {
  // Direct space ID in params
  if (req.params.spaceId && typeof req.params.spaceId === 'string') {
    return req.params.spaceId;
  }

  // For /api/spaces/:id routes
  if (req.baseUrl === "/api/spaces" && req.params.id && typeof req.params.id === 'string') {
    return req.params.id;
  }

  // Get from list
  const listId =
    req.params.listId ||
    (req.baseUrl === "/api/lists" && req.params.id) ||
    (req.path.includes("/lists/") && req.params.id);

  if (listId && typeof listId === 'string') {
    const list = await List.findById(listId).select("space");
    if (list) {
      return list.space.toString();
    }
  }

  // Get from folder
  const folderId =
    req.params.folderId ||
    (req.baseUrl === "/api/folders" && req.params.id);

  if (folderId && typeof folderId === 'string') {
    const folder = await Folder.findById(folderId).select("spaceId");
    if (folder && folder.spaceId) {
      return folder.spaceId.toString();
    }
  }

  // Get from task
  const taskId =
    req.params.taskId ||
    (req.baseUrl === "/api/tasks" && req.params.id) ||
    (req.path.includes("/tasks/") && req.params.id);

  if (taskId && typeof taskId === 'string') {
    const task = await Task.findById(taskId).select("space");
    if (task) {
      return task.space.toString();
    }
  }

  return undefined;
}

/**
 * Get folder ID from request params or related resources
 */
async function getFolderId(req: AuthRequest): Promise<string | undefined> {
  // Direct folder ID in params
  if (req.params.folderId && typeof req.params.folderId === 'string') {
    return req.params.folderId;
  }

  // For /api/folders/:id routes
  if (req.baseUrl === "/api/folders" && req.params.id && typeof req.params.id === 'string') {
    return req.params.id;
  }

  // Get from list
  const listId =
    req.params.listId ||
    (req.baseUrl === "/api/lists" && req.params.id) ||
    (req.path.includes("/lists/") && req.params.id);

  if (listId && typeof listId === 'string') {
    const list = await List.findById(listId).select("folder");
    if (list && list.folder) {
      return list.folder.toString();
    }
  }

  // Get from task
  const taskId =
    req.params.taskId ||
    (req.baseUrl === "/api/tasks" && req.params.id) ||
    (req.path.includes("/tasks/") && req.params.id);

  if (taskId && typeof taskId === 'string') {
    const task = await Task.findById(taskId).select("folder");
    if (task && task.folder) {
      return task.folder.toString();
    }
  }

  return undefined;
}

/**
 * Get list ID from request params or related resources
 */
async function getListId(req: AuthRequest): Promise<string | undefined> {
  // Direct list ID in params
  if (req.params.listId && typeof req.params.listId === 'string') {
    return req.params.listId;
  }

  // For /api/lists/:id routes
  if (req.baseUrl === "/api/lists" && req.params.id && typeof req.params.id === 'string') {
    return req.params.id;
  }

  // Get from task
  const taskId =
    req.params.taskId ||
    (req.baseUrl === "/api/tasks" && req.params.id) ||
    (req.path.includes("/tasks/") && req.params.id);

  if (taskId && typeof taskId === 'string') {
    const task = await Task.findById(taskId).select("list");
    if (task && task.list) {
      return task.list.toString();
    }
  }

  return undefined;
}

/**
 * Get workspace ID from request params or related resources
 */
async function getWorkspaceId(req: AuthRequest): Promise<string | null> {
  // Direct workspace ID in params
  if (req.params.workspaceId && typeof req.params.workspaceId === 'string') {
    return req.params.workspaceId;
  }

  // For /api/workspaces/:id routes
  if (req.baseUrl === "/api/workspaces" && req.params.id && typeof req.params.id === 'string') {
    return req.params.id;
  }

  // Get from space
  const spaceId =
    req.params.spaceId ||
    (req.baseUrl === "/api/spaces" && req.params.id) ||
    (req.path.includes("/spaces/") && req.params.id);

  if (spaceId) {
    const space = await Space.findById(spaceId).select("workspace");
    if (space) {
      return space.workspace.toString();
    }
  }

  // Get from folder
  const folderId =
    req.params.folderId ||
    (req.baseUrl === "/api/folders" && req.params.id);

  if (folderId) {
    const folder = await Folder.findById(folderId).populate('spaceId', 'workspace');
    if (folder && folder.spaceId) {
      // Check if spaceId is populated (object) or just an ID (string)
      if (typeof folder.spaceId === 'object' && (folder.spaceId as any).workspace) {
        return (folder.spaceId as any).workspace.toString();
      } else if (typeof folder.spaceId === 'string') {
        // If not populated, get the space separately
        const space = await Space.findById(folder.spaceId).select('workspace');
        if (space && space.workspace) {
          return space.workspace.toString();
        }
      }
    }
  }

  // Get from list
  const listId =
    req.params.listId ||
    (req.baseUrl === "/api/lists" && req.params.id) ||
    (req.path.includes("/lists/") && req.params.id);

  if (listId) {
    const list = await List.findById(listId).select("workspace");
    if (list) {
      return list.workspace.toString();
    }
  }

  // Get from task
  const taskId =
    req.params.taskId ||
    (req.baseUrl === "/api/tasks" && req.params.id) ||
    (req.path.includes("/tasks/") && req.params.id);

  if (taskId) {
    const task = await Task.findById(taskId).select("workspace");
    if (task) {
      return task.workspace.toString();
    }
  }

  // Get from table
  const tableId =
    req.params.tableId ||
    (req.baseUrl === "/api/tables" && req.params.id);

  if (tableId) {
    console.log('[getWorkspaceId] Resolving workspace from tableId:', tableId);
    const CustomTable = require("../models/CustomTable");
    const table = await CustomTable.findById(tableId).select("spaceId");
    console.log('[getWorkspaceId] Table found:', !!table, 'spaceId:', table?.spaceId);
    if (table && table.spaceId) {
      const space = await Space.findById(table.spaceId).select("workspace");
      console.log('[getWorkspaceId] Space found:', !!space, 'workspace:', space?.workspace);
      if (space) {
        return space.workspace.toString();
      }
    }
  }

  return null;
}

/**
 * Get resource ID from request params
 */
function getResourceId(req: AuthRequest): string | undefined {
  const id = req.params.id ||
    req.params.spaceId ||
    req.params.folderId ||
    req.params.listId ||
    req.params.taskId;
  
  return typeof id === 'string' ? id : undefined;
}

/**
 * Get resource type from request path
 */
function getResourceType(req: AuthRequest): "workspace" | "space" | "folder" | "list" | "task" | undefined {
  if (req.baseUrl.includes("/workspaces")) return "workspace";
  if (req.baseUrl.includes("/spaces")) return "space";
  if (req.baseUrl.includes("/folders")) return "folder";
  if (req.baseUrl.includes("/lists")) return "list";
  if (req.baseUrl.includes("/tasks")) return "task";
  return undefined;
}

module.exports = { requirePermission };

export {};
