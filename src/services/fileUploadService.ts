const FileAttachment = require("../models/FileAttachment");
const Task = require("../models/Task");
const TaskComment = require("../models/TaskComment");
const DirectMessage = require("../models/DirectMessage");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const socketService = require("./socketService").default;
const notificationService = require("./notificationService");
const path = require("path");
const fs = require("fs").promises;

interface UploadFileData {
  file: Express.Multer.File;
  uploadedBy: string;
  attachedTo: "Task" | "TaskComment" | "DirectMessage";
  attachedToId: string;
}

interface GetFilesOptions {
  page?: number;
  limit?: number;
}

class FileUploadService {
  /**
   * Upload file and attach to resource
   */
  async uploadFile(data: UploadFileData): Promise<any> {
    const { file, uploadedBy, attachedTo, attachedToId } = data;

    // Validate file
    if (!file) {
      throw new AppError("No file provided", 400);
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new AppError("File size exceeds 10MB limit", 400);
    }

    // Validate resource exists and user has access
    const { resource, workspace, participants } = await this.validateResourceAccess(
      attachedTo,
      attachedToId,
      uploadedBy
    );

    // Create file attachment record
    const fileAttachment = await FileAttachment.create({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
      uploadedBy,
      attachedTo,
      attachedToId,
      workspace: workspace?._id,
    });

    // Populate uploader info
    await fileAttachment.populate("uploadedBy", "name email");

    // Log activity
    try {
      if (workspace) {
        await logger.logActivity({
          userId: uploadedBy,
          workspaceId: workspace._id.toString(),
          action: "CREATE",
          resourceType: "FileAttachment",
          resourceId: fileAttachment._id.toString(),
          metadata: {
            attachedTo,
            attachedToId,
            filename: file.originalname,
            size: file.size,
          },
        });
      }
    } catch (error) {
      console.error("[FileUpload] Failed to log activity:", error);
    }

    // Emit real-time events and send notifications
    await this.emitFileUploadEvent(
      fileAttachment,
      attachedTo,
      resource,
      workspace,
      participants,
      uploadedBy
    );

    return fileAttachment;
  }

  /**
   * Validate resource access and get participants
   */
  private async validateResourceAccess(
    attachedTo: string,
    attachedToId: string,
    userId: string
  ): Promise<any> {
    let resource: any;
    let workspace: any;
    let participants: string[] = [];

    switch (attachedTo) {
      case "Task":
        resource = await Task.findOne({
          _id: attachedToId,
          isDeleted: false,
        }).lean();

        if (!resource) {
          throw new AppError("Task not found", 404);
        }

        // Verify workspace membership
        workspace = await Workspace.findOne({
          _id: resource.workspace,
          isDeleted: false,
        }).lean();

        if (!workspace) {
          throw new AppError("Workspace not found", 404);
        }

        const isMember = workspace.members.some(
          (m: any) => m.user.toString() === userId
        );

        if (!isMember) {
          throw new AppError("You do not have access to this task", 403);
        }

        // Get task participants (assignee + creator)
        participants = [resource.createdBy.toString()];
        if (resource.assignee) {
          participants.push(resource.assignee.toString());
        }
        participants = [...new Set(participants)]; // Remove duplicates

        break;

      case "TaskComment":
        resource = await TaskComment.findOne({
          _id: attachedToId,
          isDeleted: false,
        })
          .populate({
            path: "task",
            select: "workspace createdBy assignee",
          })
          .lean();

        if (!resource) {
          throw new AppError("Comment not found", 404);
        }

        const task = resource.task as any;

        // Verify workspace membership
        workspace = await Workspace.findOne({
          _id: task.workspace,
          isDeleted: false,
        }).lean();

        if (!workspace) {
          throw new AppError("Workspace not found", 404);
        }

        const isCommentMember = workspace.members.some(
          (m: any) => m.user.toString() === userId
        );

        if (!isCommentMember) {
          throw new AppError("You do not have access to this comment", 403);
        }

        // Get comment participants (comment author + task participants)
        participants = [
          resource.author.toString(),
          task.createdBy.toString(),
        ];
        if (task.assignee) {
          participants.push(task.assignee.toString());
        }
        participants = [...new Set(participants)];

        break;

      case "DirectMessage":
        const Conversation = require("../models/Conversation");
        resource = await DirectMessage.findOne({
          _id: attachedToId,
          isDeleted: false,
        })
          .populate("conversation")
          .lean();

        if (!resource) {
          throw new AppError("Message not found", 404);
        }

        const conversation = resource.conversation as any;

        // Verify user is participant
        const isParticipant = conversation.participants.some(
          (p: any) => p.toString() === userId
        );

        if (!isParticipant) {
          throw new AppError("You do not have access to this conversation", 403);
        }

        // Get conversation participants
        participants = conversation.participants.map((p: any) => p.toString());

        break;

      default:
        throw new AppError("Invalid attachment type", 400);
    }

    return { resource, workspace, participants };
  }

  /**
   * Emit file upload events and send notifications
   */
  private async emitFileUploadEvent(
    fileAttachment: any,
    attachedTo: string,
    resource: any,
    workspace: any,
    participants: string[],
    uploadedBy: string
  ): Promise<void> {
    const eventData = {
      file: {
        _id: fileAttachment._id,
        filename: fileAttachment.filename,
        originalName: fileAttachment.originalName,
        mimeType: fileAttachment.mimeType,
        size: fileAttachment.size,
        url: fileAttachment.url,
        uploadedBy: fileAttachment.uploadedBy,
        createdAt: fileAttachment.createdAt,
      },
      attachedTo,
      attachedToId: fileAttachment.attachedToId,
    };

    let eventName: string;
    let notificationTitle: string;
    let notificationBody: string;

    switch (attachedTo) {
      case "Task":
        eventName = "task:file:new";
        notificationTitle = "New file uploaded to task";
        notificationBody = `${fileAttachment.uploadedBy.name} uploaded ${fileAttachment.originalName}`;
        break;

      case "TaskComment":
        eventName = "comment:file:new";
        notificationTitle = "New file uploaded to comment";
        notificationBody = `${fileAttachment.uploadedBy.name} uploaded ${fileAttachment.originalName}`;
        break;

      case "DirectMessage":
        eventName = "dm:file:new";
        notificationTitle = "New file received";
        notificationBody = `${fileAttachment.uploadedBy.name} sent you ${fileAttachment.originalName}`;
        break;

      default:
        return;
    }

    // Emit to online participants
    participants.forEach((participantId) => {
      if (participantId !== uploadedBy) {
        const isOnline = socketService.isUserOnline(participantId);

        if (isOnline) {
          // User is online - emit socket event
          socketService.emitToUser(participantId, eventName, eventData);
        } else {
          // User is offline - send push notification
          notificationService
            .createNotification({
              recipientId: participantId,
              type: "MENTION",
              title: notificationTitle,
              body: notificationBody,
              data: {
                resourceId: fileAttachment._id.toString(),
                resourceType: "FileAttachment",
                attachedTo,
                attachedToId: fileAttachment.attachedToId.toString(),
                workspaceId: workspace?._id?.toString(),
              },
            })
            .catch((error: any) => {
              console.error(
                `[FileUpload] Failed to send notification to ${participantId}:`,
                error
              );
            });
        }
      }
    });
  }

  /**
   * Get files for a resource
   */
  async getFiles(
    attachedTo: string,
    attachedToId: string,
    userId: string,
    options: GetFilesOptions = {}
  ): Promise<any> {
    // Validate access
    await this.validateResourceAccess(attachedTo, attachedToId, userId);

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await FileAttachment.countDocuments({
      attachedTo,
      attachedToId,
      isDeleted: false,
    });

    // Get files
    const files = await FileAttachment.find({
      attachedTo,
      attachedToId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email")
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
   * Delete file
   */
  async deleteFile(fileId: string, userId: string): Promise<any> {
    const file = await FileAttachment.findOne({
      _id: fileId,
      isDeleted: false,
    });

    if (!file) {
      throw new AppError("File not found", 404);
    }

    // Validate access
    const { workspace } = await this.validateResourceAccess(
      file.attachedTo,
      file.attachedToId.toString(),
      userId
    );

    // Only uploader or workspace admin can delete
    const isUploader = file.uploadedBy.toString() === userId;
    const member = workspace?.members.find(
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

    // Delete physical file
    try {
      const filePath = path.join(__dirname, "../../", file.url);
      await fs.unlink(filePath);
    } catch (error) {
      console.error("[FileUpload] Failed to delete physical file:", error);
    }

    // Log activity
    try {
      if (workspace) {
        await logger.logActivity({
          userId,
          workspaceId: workspace._id.toString(),
          action: "DELETE",
          resourceType: "FileAttachment",
          resourceId: fileId,
          metadata: {
            attachedTo: file.attachedTo,
            attachedToId: file.attachedToId.toString(),
            filename: file.originalName,
          },
        });
      }
    } catch (error) {
      console.error("[FileUpload] Failed to log activity:", error);
    }

    return { message: "File deleted successfully" };
  }
}

module.exports = new FileUploadService();

export {};
