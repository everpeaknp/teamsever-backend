import { Response, NextFunction } from "express";

const Workspace = require("../models/Workspace");

interface AuthRequest {
  user?: {
    id: string;
    _id?: string;
  };
  params?: any;
  workspace?: any;
  baseUrl?: string;
}

/**
 * Middleware to ensure only workspace owners can perform certain actions
 * Fetches workspace from the resource being accessed
 */
const ownerOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Get workspace ID from permission context or fetch it from the resource
    let workspaceId = (req as any).permissionContext?.workspaceId;
    
    if (!workspaceId) {
      // Try to get workspace from the resource
      const Space = require("../models/Space");
      const Folder = require("../models/Folder");
      const List = require("../models/List");
      
      // Check if it's a space
      if (req.params.id && req.baseUrl.includes('/spaces')) {
        const space = await Space.findById(req.params.id).select('workspace');
        if (space) {
          workspaceId = space.workspace.toString();
        }
      }
      // Check if it's a folder
      else if (req.params.id && req.baseUrl.includes('/folders')) {
        const folder = await Folder.findById(req.params.id).populate('spaceId', 'workspace');
        if (folder && folder.spaceId) {
          if (typeof folder.spaceId === 'object') {
            workspaceId = (folder.spaceId as any).workspace.toString();
          } else {
            const space = await Space.findById(folder.spaceId).select('workspace');
            if (space) {
              workspaceId = space.workspace.toString();
            }
          }
        }
      }
      // Check if it's a list
      else if (req.params.id && req.baseUrl.includes('/lists')) {
        const list = await List.findById(req.params.id).select('workspace');
        if (list) {
          workspaceId = list.workspace.toString();
        }
      }
    }
    
    if (!workspaceId) {
      return res.status(500).json({
        success: false,
        message: "Workspace context not found"
      });
    }

    // Fetch workspace and check ownership
    const workspace = await Workspace.findById(workspaceId);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found"
      });
    }

    // Check if user is the workspace owner
    const ownerId = workspace.owner.toString();
    
    if (userId !== ownerId) {
      return res.status(403).json({
        success: false,
        message: "Only workspace owners can perform this action"
      });
    }

    // Attach workspace to request for use in controllers
    req.workspace = workspace;

    next();
  } catch (error: any) {
    console.error("[Owner Only Middleware] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking ownership"
    });
  }
};

module.exports = ownerOnly;
export default ownerOnly;
