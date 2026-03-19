import { cloudinary } from "../config/cloudinary";
import socketService from "./socketService";

const Attachment = require("../models/Attachment");
const Task = require("../models/Task");
const TaskComment = require("../models/TaskComment");
const Conversation = require("../models/Conversation");
const Workspace = require("../models/Workspace");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const enhancedNotificationService = require("./enhancedNotificationService");

interface UploadFileData {
  file: Express.Multer.File & { public_id?: string; secure_url?: string };
  uploadedBy: string;
  taskId?: string;
  commentId?: string;
  conversationId?: string;
  messageId?: string;
}

class UploadService {
  /**
   * Upload file for task
   */
  async uploadTaskAttachment(data: UploadFileData): Promise<any> {
    const { file, uploadedBy, taskId } = data;

    if (!taskId) {
      throw new AppError("Task ID is required", 400);
    }

    // Verify task exists and user has access
    const task = await Task.findById(taskId).lean();
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === uploadedBy
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Get file URL and public_id from Cloudinary
    const publicId = (file as any).public_id || file.filename;
    const fileUrl = (file as any).secure_url || (file as any).url;

    // Create attachment record
    const attachment = await Attachment.create({
      filename: publicId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      publicId: publicId,
      uploadedBy,
      task: taskId,
      workspace: workspace._id,
    });

    // Populate uploader info
    await attachment.populate("uploadedBy", "name email");

    // Log activity
    try {
      await logger.logActivity({
        userId: uploadedBy,
        workspaceId: workspace._id.toString(),
        action: "CREATE",
        resourceType: "Attachment",
        resourceId: attachment._id.toString(),
        metadata: {
          taskId,
          filename: file.originalname,
          size: file.size,
        },
      });
    } catch (error) {
      console.error("[Upload] Failed to log activity:", error);
    }

    // Emit real-time event
    try {
      const { emitTaskEvent } = require("../socket/events");
      emitTaskEvent(
        taskId,
        "updated",
        {
          attachment: {
            _id: attachment._id,
            filename: attachment.originalName,
            url: attachment.url,
            size: attachment.size,
            mimeType: attachment.mimeType,
            uploadedBy: attachment.uploadedBy,
          },
        },
        uploadedBy
      );
    } catch (error) {
      console.error("[Upload] Failed to emit real-time event:", error);
    }

    // Send notifications
    try {
      await enhancedNotificationService.notifyFileUpload(
        attachment._id.toString(),
        uploadedBy,
        "Task",
        taskId,
        file.originalname
      );
    } catch (error) {
      console.error("[Upload] Failed to send notifications:", error);
    }

    return attachment;
  }

  /**
   * Upload file for comment
   */
  async uploadCommentAttachment(data: UploadFileData): Promise<any> {
    const { file, uploadedBy, commentId } = data;

    if (!commentId) {
      throw new AppError("Comment ID is required", 400);
    }

    // Verify comment exists
    const comment = await TaskComment.findById(commentId).lean();
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Verify task access
    const task = await Task.findById(comment.task).lean();
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === uploadedBy
    );

    if (!isMember) {
      throw new AppError("You do not have access to this comment", 403);
    }

    // Get file URL and public_id from Cloudinary
    const publicId = (file as any).public_id || file.filename;
    const fileUrl = (file as any).secure_url || (file as any).url;

    // Create attachment record
    const attachment = await Attachment.create({
      filename: publicId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      publicId: publicId,
      uploadedBy,
      comment: commentId,
      task: task._id,
      workspace: workspace._id,
    });

    // Populate uploader info
    await attachment.populate("uploadedBy", "name email");

    // Log activity
    try {
      await logger.logActivity({
        userId: uploadedBy,
        workspaceId: workspace._id.toString(),
        action: "CREATE",
        resourceType: "Attachment",
        resourceId: attachment._id.toString(),
        metadata: {
          commentId,
          taskId: task._id.toString(),
          filename: file.originalname,
          size: file.size,
        },
      });
    } catch (error) {
      console.error("[Upload] Failed to log activity:", error);
    }

    // Emit real-time event
    try {
      const { emitTaskEvent } = require("../socket/events");
      emitTaskEvent(
        task._id.toString(),
        "comment_updated",
        {
          commentId,
          attachment: {
            _id: attachment._id,
            filename: attachment.originalName,
            url: attachment.url,
            size: attachment.size,
            mimeType: attachment.mimeType,
            uploadedBy: attachment.uploadedBy,
          },
        },
        uploadedBy
      );
    } catch (error) {
      console.error("[Upload] Failed to emit real-time event:", error);
    }

    // Send notifications
    try {
      await enhancedNotificationService.notifyFileUpload(
        attachment._id.toString(),
        uploadedBy,
        "Comment",
        commentId,
        file.originalname
      );
    } catch (error) {
      console.error("[Upload] Failed to send notifications:", error);
    }

    return attachment;
  }

  /**
   * Upload file for direct message
   */
  async uploadDMAttachment(data: UploadFileData): Promise<any> {
    const { file, uploadedBy, conversationId } = data;

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
    }

    // Verify conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === uploadedBy
    );

    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }

    // Get file URL and public_id from Cloudinary
    const publicId = (file as any).public_id || file.filename;
    const fileUrl = (file as any).secure_url || (file as any).url;

    // Create attachment record
    const attachment = await Attachment.create({
      filename: publicId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      publicId: publicId,
      uploadedBy,
      conversation: conversationId,
    });

    // Populate uploader info
    await attachment.populate("uploadedBy", "name email");

    // Emit real-time event to other participant
    try {
      const otherParticipant = conversation.participants.find(
        (p: any) => p.toString() !== uploadedBy
      );

      if (otherParticipant) {
        socketService.emitToUser(otherParticipant.toString(), "dm:file:new", {
          conversationId,
          attachment: {
            _id: attachment._id,
            filename: attachment.originalName,
            url: attachment.url,
            size: attachment.size,
            mimeType: attachment.mimeType,
            uploadedBy: attachment.uploadedBy,
          },
        });
      }
    } catch (error) {
      console.error("[Upload] Failed to emit real-time event:", error);
    }

    return attachment;
  }

  /**
   * Upload logo for workspace
   */
  async uploadWorkspaceLogo(data: { file: any; workspaceId: string; uploadedBy: string }): Promise<any> {
    const { file, workspaceId, uploadedBy } = data;

    // Verify workspace exists and user is owner
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      isDeleted: false,
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    if (workspace.owner.toString() !== uploadedBy) {
      throw new AppError("Only workspace owner can upload logo", 403);
    }

    // Cloudinary upload logic
    const streamUpload = (fileBuffer: Buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `workspaces/${workspaceId}`,
            resource_type: "image",
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        stream.end(fileBuffer);
      });
    };

    const cloudinaryResult = (await streamUpload(file.buffer)) as any;
    const fileUrl = cloudinaryResult.secure_url;

    // Update workspace logo
    workspace.logo = fileUrl;
    await workspace.save();

    // Log activity
    try {
      await logger.logActivity({
        userId: uploadedBy,
        workspaceId,
        action: "UPDATE",
        resourceType: "Workspace",
        resourceId: workspaceId,
        metadata: {
          field: "logo",
          filename: file.originalname,
        },
      });
    } catch (error) {
      console.error("[Upload] Failed to log activity:", error);
    }

    return {
      message: "Logo uploaded successfully",
      logo: fileUrl,
    };
  }

  /**
   * Get attachments for task
   */
  async getTaskAttachments(taskId: string, userId: string): Promise<any[]> {
    // Verify task access
    const task = await Task.findById(taskId).lean();
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this task", 403);
    }

    // Get attachments
    const attachments = await Attachment.find({
      task: taskId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return attachments;
  }

  /**
   * Get attachments for comment
   */
  async getCommentAttachments(commentId: string, userId: string): Promise<any[]> {
    // Verify comment exists
    const comment = await TaskComment.findById(commentId).lean();
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Verify task access
    const task = await Task.findById(comment.task).lean();
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Verify workspace membership
    const workspace = await Workspace.findOne({
      _id: task.workspace,
      isDeleted: false,
    }).lean();

    if (!workspace) {
      throw new AppError("Workspace not found", 404);
    }

    const isMember = workspace.members.some(
      (member: any) => member.user.toString() === userId
    );

    if (!isMember) {
      throw new AppError("You do not have access to this comment", 403);
    }

    // Get attachments
    const attachments = await Attachment.find({
      comment: commentId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return attachments;
  }

  /**
   * Get attachments for conversation
   */
  async getConversationAttachments(conversationId: string, userId: string): Promise<any[]> {
    // Verify conversation access
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === userId
    );

    if (!isParticipant) {
      throw new AppError("You do not have access to this conversation", 403);
    }

    // Get attachments
    const attachments = await Attachment.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return attachments;
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    // Find attachment
    const attachment = await Attachment.findById(attachmentId);
    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    // Check if user is the uploader or has admin rights
    const isUploader = attachment.uploadedBy.toString() === userId;

    if (!isUploader) {
      // Check if user is workspace admin
      if (attachment.workspace) {
        const workspace = await Workspace.findById(attachment.workspace).lean();
        if (workspace) {
          const member = workspace.members.find(
            (m: any) => m.user.toString() === userId
          );
          const isAdmin = member && (member.role === "owner" || member.role === "admin");

          if (!isAdmin) {
            throw new AppError("You do not have permission to delete this attachment", 403);
          }
        }
      } else {
        throw new AppError("You do not have permission to delete this attachment", 403);
      }
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(attachment.publicId, {
        resource_type: attachment.fileType || "auto",
        invalidate: true
      });
    } catch (error) {
      console.error("[Upload] Failed to delete file from Cloudinary:", error);
      // Continue with soft delete even if Cloudinary deletion fails
    }

    // Soft delete attachment
    attachment.isDeleted = true;
    attachment.deletedAt = new Date();
    attachment.deletedBy = userId;
    await attachment.save();

    // Log activity
    if (attachment.workspace) {
      try {
        await logger.logActivity({
          userId,
          workspaceId: attachment.workspace.toString(),
          action: "DELETE",
          resourceType: "Attachment",
          resourceId: attachmentId,
          metadata: {
            filename: attachment.originalName,
          },
        });
      } catch (error) {
        console.error("[Upload] Failed to log activity:", error);
      }
    }
  }

  /**
   * Upload profile picture for user
   */
  async uploadProfilePicture(file: any, userId: string): Promise<any> {
    const streamUpload = (fileBuffer: Buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `users/${userId}/profile`,
            resource_type: "image",
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        stream.end(fileBuffer);
      });
    };

    const cloudinaryResult = (await streamUpload(file.buffer)) as any;
    return {
      url: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
    };
  }
}

module.exports = new UploadService();
export {};
