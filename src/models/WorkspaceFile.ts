import { Schema, model, Document, Types } from "mongoose";

export interface IWorkspaceFile extends Document {
  workspace: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  resourceType: string;
  format: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceFileSchema = new Schema<IWorkspaceFile>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: ["image", "video", "raw", "auto"],
    },
    format: {
      type: String,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
workspaceFileSchema.index({ workspace: 1, isDeleted: 1, createdAt: -1 });
workspaceFileSchema.index({ uploadedBy: 1, createdAt: -1 });

const WorkspaceFile = model<IWorkspaceFile>("WorkspaceFile", workspaceFileSchema);

module.exports = WorkspaceFile;
export {};
