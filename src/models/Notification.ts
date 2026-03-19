import { Schema, model, Document, Types } from "mongoose";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: 
    | "TASK_ASSIGNED" 
    | "TASK_UPDATE" 
    | "TASK_STATUS_CHANGED"
    | "TASK_PRIORITY_CHANGED"
    | "COMMENT_ADDED"
    | "COMMENT_UPDATED" 
    | "COMMENT_DELETED"
    | "COMMENT_MENTION"
    | "DM_NEW"
    | "FILE_UPLOAD"
    | "INVITATION"
    | "INVITE_ACCEPTED"
    | "SPACE_INVITATION"
    | "SYSTEM";
  title: string;
  body: string;
  data: {
    resourceId?: Types.ObjectId;
    resourceType?: string;
    workspaceId?: Types.ObjectId;
    spaceId?: Types.ObjectId;
    taskId?: Types.ObjectId;
    commentId?: Types.ObjectId;
    conversationId?: Types.ObjectId;
    attachmentId?: Types.ObjectId;
    token?: string;
    inviteUrl?: string;
    [key: string]: any;
  };
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "TASK_ASSIGNED",
        "TASK_UPDATE",
        "TASK_STATUS_CHANGED",
        "TASK_PRIORITY_CHANGED",
        "COMMENT_ADDED",
        "COMMENT_UPDATED",
        "COMMENT_DELETED",
        "COMMENT_MENTION",
        "DM_NEW",
        "FILE_UPLOAD",
        "INVITATION",
        "INVITE_ACCEPTED",
        "SPACE_INVITATION",
        "SYSTEM"
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const Notification = model<INotification>("Notification", notificationSchema);

module.exports = Notification;
export {};
