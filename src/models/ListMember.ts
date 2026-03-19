import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

/**
 * List Permission Levels
 * Defines granular access control at the list level
 */
export enum ListPermissionLevel {
  FULL = "FULL",       // Full access to list (create, edit, delete tasks)
  EDIT = "EDIT",       // Can create and edit tasks, cannot delete
  COMMENT = "COMMENT", // Can only comment on tasks
  VIEW = "VIEW"        // Read-only access
}

export interface IListMember extends Document {
  user: Schema.Types.ObjectId;
  list: Schema.Types.ObjectId;
  folder: Schema.Types.ObjectId | null; // Optional - list may not be in a folder
  space: Schema.Types.ObjectId;         // Denormalized for performance
  workspace: Schema.Types.ObjectId;     // Denormalized for performance
  permissionLevel: ListPermissionLevel;
  addedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const listMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null
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
      enum: Object.values(ListPermissionLevel),
      required: true,
      default: ListPermissionLevel.EDIT
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

// Unique constraint: one permission level per user per list
listMemberSchema.index({ user: 1, list: 1 }, { unique: true });

// Performance indexes
listMemberSchema.index({ list: 1 });
listMemberSchema.index({ user: 1 });
listMemberSchema.index({ folder: 1 });
listMemberSchema.index({ space: 1 });
listMemberSchema.index({ workspace: 1 });

const ListMember =
  mongoose.models.ListMember ||
  mongoose.model("ListMember", listMemberSchema);

module.exports = {
  ListMember,
  ListPermissionLevel,
};
