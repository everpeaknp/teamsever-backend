const Document = require("../models/Document");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const EntitlementService = require("../services/entitlementService").default;

/**
 * Create a new document
 * POST /api/docs
 */
exports.createDocument = async (req: any, res: any, next: any) => {
  try {
    const { title, workspaceId, parentId, icon, spaceId } = req.body;
    const userId = req.user.id;

    // If workspace is provided, verify user has access
    let ownerId = userId;
    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return next(new AppError("Workspace not found", 404));
      }

      const member = workspace.members.find(
        (m: any) => m.user.toString() === userId
      );

      if (!member) {
        return next(new AppError("You do not have access to this workspace", 403));
      }

      // Validate space access if provided
      if (spaceId) {
        const isPrivileged = member.role === "owner" || member.role === "admin" || member.role === "operations_manager";
        if (!isPrivileged) {
          const Space = require("../models/Space");
          const space = await Space.findById(spaceId).lean();
          if (!space) {
            return next(new AppError("Space not found", 404));
          }
          const isSpaceMember = space.members?.some(
            (sm: any) => sm.user?.toString() === userId
          );
          if (!isSpaceMember) {
            return next(new AppError("You do not have permission to create documents in this space", 403));
          }
        }
      }

      ownerId = workspace.owner.toString();
    }

    // Check entitlement
    const entitlement = await EntitlementService.canCreateDocument(ownerId);
    if (!entitlement.allowed) {
      return res.status(403).json({
        success: false,
        message: entitlement.reason || 'Cannot create document',
        code: 'DOCUMENT_LIMIT_REACHED'
      });
    }

    const document = await Document.create({
      title: title || "Untitled",
      owner: userId,
      workspace: workspaceId || null,
      space: spaceId || null,
      parentId: parentId || null,
      icon: icon || "📄",
      content: {
        type: "doc",
        content: []
      }
    });

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all documents for a workspace
 * GET /api/docs/workspace/:workspaceId
 */
exports.getWorkspaceDocuments = async (req: any, res: any, next: any) => {
  try {
    const { workspaceId } = req.params;
    const { spaceId } = req.query;
    const userId = req.user.id;

    // Verify user has access to workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    const wsMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );

    if (!wsMember) {
      return next(new AppError("You do not have access to this workspace", 403));
    }

    const isPrivileged = wsMember.role === "owner" || wsMember.role === "admin" || wsMember.role === "operations_manager";
    
    const query: any = {
      workspace: workspaceId,
      isArchived: false
    };

    if (spaceId) {
      if (!isPrivileged) {
        const Space = require("../models/Space");
        const space = await Space.findById(spaceId).lean();
        if (!space) {
          return next(new AppError("Space not found", 404));
        }
        const isSpaceMember = space.members?.some(
          (sm: any) => sm.user?.toString() === userId
        );
        if (!isSpaceMember) {
          return next(new AppError("You do not have permission to access documents in this space", 403));
        }
      }
      query.space = spaceId === "null" ? null : spaceId;
    } else if (!isPrivileged) {
      const HierarchyService = require("../services/hierarchyService").default;
      const hierarchy = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId, wsMember.role);
      const visibleSpaceIds = hierarchy.spaces.map((s: any) => s._id.toString());
      
      query.$or = [
        { space: { $in: visibleSpaceIds } },
        { space: null }
      ];
    }

    const documents = await Document.find(query)
      .populate("owner", "name email avatar profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's private documents
 * GET /api/docs/me
 */
exports.getMyDocuments = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.id;

    const documents = await Document.find({
      owner: userId,
      workspace: null, // Private documents
      isArchived: false
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single document by ID
 * GET /api/docs/:id
 */
exports.getDocument = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const document = await Document.findById(id)
      .populate("owner", "name email avatar profilePicture")
      .populate("collaborators.user", "name email avatar profilePicture");

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Check if user has access
    const isOwner = document.owner._id.toString() === userId;
    const isCollaborator = document.collaborators.some(
      (collab: any) => collab.user._id.toString() === userId
    );
    
    let hasWorkspaceAccess = false;
    if (document.workspace) {
      const workspace = await Workspace.findById(document.workspace);
      if (workspace) {
        const wsMember = workspace.members.find(
          (m: any) => m.user.toString() === userId
        );
        
        if (wsMember) {
          const isPrivileged = wsMember.role === "owner" || wsMember.role === "admin" || wsMember.role === "operations_manager";
          
          if (isPrivileged || !document.space) {
            hasWorkspaceAccess = true;
          } else {
            // Need-to-Know check for space documents
            const HierarchyService = require("../services/hierarchyService").default;
            const hierarchy = await HierarchyService.getWorkspaceHierarchy(document.workspace.toString(), userId, wsMember.role);
            const visibleSpaceIds = hierarchy.spaces.map((s: any) => s._id.toString());
            
            if (visibleSpaceIds.includes(document.space.toString())) {
              hasWorkspaceAccess = true;
            }
          }
        }
      }
    }

    if (!isOwner && !isCollaborator && !hasWorkspaceAccess) {
      return next(new AppError("You do not have access to this document", 403));
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update document
 * PATCH /api/docs/:id
 */
exports.updateDocument = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const document = await Document.findById(id);

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Check if user has edit permission
    const isOwner = document.owner.toString() === userId;
    const hasEditPermission = document.collaborators.some(
      (collab: any) => 
        collab.user.toString() === userId && collab.permission === "edit"
    );

    if (!isOwner && !hasEditPermission) {
      return next(new AppError("You do not have permission to edit this document", 403));
    }

    // Update allowed fields
    const allowedUpdates = ["title", "content", "icon", "coverImage", "isPublished"];
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        (document as any)[key] = updates[key];
      }
    });

    await document.save();

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete document
 * DELETE /api/docs/:id
 */
exports.deleteDocument = async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const document = await Document.findById(id);

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Only owner can delete
    if (document.owner.toString() !== userId) {
      return next(new AppError("Only the owner can delete this document", 403));
    }

    // Soft delete by archiving
    document.isArchived = true;
    await document.save();

    res.status(200).json({
      success: true,
      message: "Document archived successfully"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get document hierarchy (nested structure)
 * GET /api/docs/workspace/:workspaceId/hierarchy
 */
exports.getDocumentHierarchy = async (req: any, res: any, next: any) => {
  try {
    const { workspaceId } = req.params;
    const { spaceId } = req.query;
    const userId = req.user.id;

    // Verify access
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(new AppError("Workspace not found", 404));
    }

    const wsMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );

    if (!wsMember) {
      return next(new AppError("You do not have access to this workspace", 403));
    }

    const isPrivileged = wsMember.role === "owner" || wsMember.role === "admin" || wsMember.role === "operations_manager";
    
    const query: any = {
      workspace: workspaceId,
      isArchived: false
    };

    if (spaceId) {
      if (!isPrivileged) {
        const Space = require("../models/Space");
        const space = await Space.findById(spaceId).lean();
        if (!space) {
          return next(new AppError("Space not found", 404));
        }
        const isSpaceMember = space.members?.some(
          (sm: any) => sm.user?.toString() === userId
        );
        if (!isSpaceMember) {
          return next(new AppError("You do not have permission to access documents in this space", 403));
        }
      }
      query.space = spaceId === "null" ? null : spaceId;
    } else if (!isPrivileged) {
      const HierarchyService = require("../services/hierarchyService").default;
      const hierarchy = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId, wsMember.role);
      const visibleSpaceIds = hierarchy.spaces.map((s: any) => s._id.toString());
      
      query.$or = [
        { space: { $in: visibleSpaceIds } },
        { space: null }
      ];
    }

    // Get all documents the user has access to
    const documents = await Document.find(query)
      .populate("owner", "name email avatar profilePicture")
      .sort({ createdAt: -1 });

    // Build hierarchy
    const buildHierarchy = (parentId: any = null): any[] => {
      return documents
        .filter((doc: any) => {
          const docParentId = doc.parentId ? doc.parentId.toString() : null;
          return docParentId === parentId;
        })
        .map((doc: any) => ({
          ...doc.toObject(),
          children: buildHierarchy(doc._id.toString())
        }));
    };

    const hierarchy = buildHierarchy(null);

    res.status(200).json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    next(error);
  }
};

export {};
