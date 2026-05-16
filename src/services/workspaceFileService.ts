const WorkspaceFile = require("../models/WorkspaceFile");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const cloudinary = require("../config/cloudinary").default;

interface UploadFileData {
  workspaceId: string;
  userId: string;
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  fileName: string;
  fileType: string;
  spaceId?: string;
}

interface GetFilesOptions {
  page?: number;
  limit?: number;
  search?: string;
  spaceId?: string;
}

class WorkspaceFileService {
  /**
   * Validate workspace membership
   */
  async validateWorkspaceMembership(workspaceId: string, userId: string): Promise<any> {
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You must be a workspace member to access files", 403);
    }

    return workspace;
  }

  /**
   * Validate space access
   */
  async validateSpaceAccess(spaceId: string, userId: string, workspace: any): Promise<void> {
    const Space = require("../models/Space");
    
    const wsMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isAdmin = wsMember && (wsMember.role === "owner" || wsMember.role === "admin");

    if (isAdmin) return; // Admins can access everything

    const space = await Space.findById(spaceId).lean();
    if (!space) {
      throw new AppError("Space not found", 404);
    }

    const isSpaceMember = space.members?.some(
      (member: any) => member.user?.toString() === userId
    );

    if (!isSpaceMember) {
      throw new AppError("You do not have permission to access this space's files", 403);
    }
  }

  /**
   * Generate Cloudinary upload signature
   */
  async generateUploadSignature(workspaceId: string, userId: string) {
    // Validate workspace membership
    await this.validateWorkspaceMembership(workspaceId, userId);

    // Check if Cloudinary is configured
    const { isCloudinaryConfigured } = require("../config/cloudinary");
    if (!isCloudinaryConfigured()) {
      throw new AppError("Cloudinary is not configured. Please check environment variables.", 503);
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `workspace-files/${workspaceId}`;

    // Parameters to sign - must match what's sent to Cloudinary
    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
    };
  }

  /**
   * Save file after Cloudinary upload
   */
  async saveFile(data: UploadFileData) {
    const {
      workspaceId,
      userId,
      secure_url,
      public_id,
      resource_type,
      format,
      bytes,
      fileName,
      fileType,
      spaceId,
    } = data;

    // Validate workspace membership
    const workspace = await this.validateWorkspaceMembership(workspaceId, userId);

    // Validate space access if provided
    if (spaceId) {
      await this.validateSpaceAccess(spaceId, userId, workspace);
    }

    // Create file record
    const file = await WorkspaceFile.create({
      workspace: workspaceId,
      uploadedBy: userId,
      fileName,
      originalName: fileName,
      fileType,
      fileSize: bytes,
      cloudinaryUrl: secure_url,
      cloudinaryPublicId: public_id,
      resourceType: resource_type,
      format,
      space: spaceId || null,
    });

    // Populate uploader info
    await file.populate("uploadedBy", "name email avatar profilePicture");

    // Log activity
    try {
      await logger.logActivity({
        userId,
        workspaceId,
        action: "CREATE",
        resourceType: "WorkspaceFile",
        resourceId: file._id.toString(),
        metadata: {
          fileName,
          fileSize: bytes,
          fileType,
        },
      });
    } catch (error) {
      console.error("[WorkspaceFile] Failed to log activity:", error);
    }

    return file;
  }

  /**
   * Get workspace files with pagination and search
   */
  async getFiles(
    workspaceId: string,
    userId: string,
    options: GetFilesOptions = {}
  ) {
    // Validate workspace membership
    const workspace = await this.validateWorkspaceMembership(workspaceId, userId);

    const wsMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isPrivileged = wsMember && (wsMember.role === "owner" || wsMember.role === "admin" || wsMember.role === "operations_manager");

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {
      workspace: workspaceId,
      isDeleted: false,
    };

    // If not privileged, restrict to visible spaces
    if (!isPrivileged) {
      const HierarchyService = require("./hierarchyService").default;
      const hierarchy = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId, wsMember.role);
      const visibleSpaceIds = hierarchy.spaces.map((s: any) => s._id.toString());
      
      // If filtering by specific spaceId, check if it's visible
      if (options.spaceId && options.spaceId !== "null") {
        if (!visibleSpaceIds.includes(options.spaceId)) {
          throw new AppError("You do not have permission to access this space's files", 403);
        }
        query.space = options.spaceId;
      } else if (options.spaceId === "null") {
        query.space = null;
      } else {
        // "All Files" view for non-admin: only show files from visible spaces OR files not attached to any space
        query.$or = [
          { space: { $in: visibleSpaceIds } },
          { space: null }
        ];
      }
    } else {
      // Admins can see everything
      if (options.spaceId) {
        if (options.spaceId === "null") {
          query.space = null;
        } else {
          query.space = options.spaceId;
        }
      }
    }

    // Add search filter
    if (options.search) {
      query.$or = query.$or || [];
      const searchFilter = [
        { fileName: { $regex: options.search, $options: "i" } },
        { originalName: { $regex: options.search, $options: "i" } },
      ];
      
      if (query.$or.length > 0) {
        // Handle existing $or from visibility filtering
        const originalOr = query.$or;
        delete query.$or;
        query.$and = [
          { $or: originalOr },
          { $or: searchFilter }
        ];
      } else {
        query.$or = searchFilter;
      }
    }

    // Get total count
    const total = await WorkspaceFile.countDocuments(query);

    // Get files
    const files = await WorkspaceFile.find(query)
      .populate("uploadedBy", "name email avatar profilePicture")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      files,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Get single file
   */
  async getFile(fileId: string, userId: string) {
    const file = await WorkspaceFile.findOne({
      _id: fileId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email avatar profilePicture")
      .lean();

    if (!file) {
      throw new AppError("File not found", 404);
    }

    // Validate workspace membership
    const workspace = await this.validateWorkspaceMembership(file.workspace.toString(), userId);

    // Check space visibility for non-admins
    const wsMember = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isPrivileged = wsMember && (wsMember.role === "owner" || wsMember.role === "admin" || wsMember.role === "operations_manager");

    if (!isPrivileged && file.space) {
      const HierarchyService = require("./hierarchyService").default;
      const hierarchy = await HierarchyService.getWorkspaceHierarchy(file.workspace.toString(), userId, wsMember.role);
      const visibleSpaceIds = hierarchy.spaces.map((s: any) => s._id.toString());

      if (!visibleSpaceIds.includes(file.space.toString())) {
        throw new AppError("You do not have permission to access this file", 403);
      }
    }

    return file;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId: string) {
    const file = await WorkspaceFile.findOne({
      _id: fileId,
      isDeleted: false,
    });

    if (!file) {
      throw new AppError("File not found", 404);
    }

    // Validate workspace membership
    const workspace = await this.validateWorkspaceMembership(
      file.workspace.toString(),
      userId
    );

    // Check permissions - only uploader or admin/owner can delete
    const isUploader = file.uploadedBy.toString() === userId;
    const member = workspace.members.find(
      (m: any) => m.user.toString() === userId
    );
    const isAdmin = member && (member.role === "owner" || member.role === "admin");

    if (!isUploader && !isAdmin) {
      throw new AppError("You do not have permission to delete this file", 403);
    }

    // Soft delete
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.cloudinaryPublicId, {
        resource_type: file.resourceType,
      });
      console.log(`[WorkspaceFile] Deleted from Cloudinary: ${file.cloudinaryPublicId}`);
    } catch (error) {
      console.error("[WorkspaceFile] Failed to delete from Cloudinary:", error);
    }

    // Log activity
    try {
      await logger.logActivity({
        userId,
        workspaceId: file.workspace.toString(),
        action: "DELETE",
        resourceType: "WorkspaceFile",
        resourceId: fileId,
        metadata: {
          fileName: file.fileName,
        },
      });
    } catch (error) {
      console.error("[WorkspaceFile] Failed to log activity:", error);
    }

    return { message: "File deleted successfully" };
  }
}

module.exports = new WorkspaceFileService();

export {};
