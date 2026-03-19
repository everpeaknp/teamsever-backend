import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

/**
 * Folder Permission Levels
 * Defines granular access control at the folder level
 */
export enum FolderPermissionLevel {
  FULL = "FULL",       // Full access to folder (create, edit, delete)
  EDIT = "EDIT",       // Can create and edit lists/tasks, cannot delete
  COMMENT = "COMMENT", // Can only comment on tasks
  VIEW = "VIEW"        // Read-only access
}

export interface IFolderMember extends Document {
  user: Schema.Types.ObjectId;
  folder: Schema.Types.ObjectId;
  space: Schema.Types.ObjectId;      // Denormalized for performance
  workspace: Schema.Types.ObjectId;  // Denormalized for performance
  permissionLevel: FolderPermissionLevel;
  addedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const folderMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      required: true
    },
    space: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    permissionLevel: {
      type: String,
      enum: Object.values(FolderPermissionLevel),
      required: true,
      default: FolderPermissionLevel.EDIT
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Unique constraint: one permission level per user per folder
folderMemberSchema.index({ user: 1, folder: 1 }, { unique: true });

// Performance indexes
folderMemberSchema.index({ folder: 1 });
folderMemberSchema.index({ user: 1 });
folderMemberSchema.index({ space: 1 });
folderMemberSchema.index({ workspace: 1 });

module.exports = mongoose.models.FolderMember || mongoose.model("FolderMember", folderMemberSchema);
export {};
