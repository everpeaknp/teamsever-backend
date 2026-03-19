import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface IFileAttachment extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: Schema.Types.ObjectId;
  
  // Polymorphic reference
  attachedTo: "Task" | "TaskComment" | "DirectMessage";
  attachedToId: Schema.Types.ObjectId;
  
  // Denormalized for queries
  workspace?: Schema.Types.ObjectId;
  
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const fileAttachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attachedTo: {
      type: String,
      enum: ["Task", "TaskComment", "DirectMessage"],
      required: true,
    },
    attachedToId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "attachedTo",
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
fileAttachmentSchema.index({ attachedTo: 1, attachedToId: 1, isDeleted: 1 });
fileAttachmentSchema.index({ uploadedBy: 1, isDeleted: 1 });
fileAttachmentSchema.index({ workspace: 1, isDeleted: 1 });
fileAttachmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("FileAttachment", fileAttachmentSchema);
export {};
