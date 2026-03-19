import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

/**
 * Space Permission Levels
 * Defines granular access control at the space level
 */
export enum SpacePermissionLevel {
  FULL = "FULL",       // Full access to space (create, edit, delete)
  EDIT = "EDIT",       // Can create and edit tasks, cannot delete
  COMMENT = "COMMENT", // Can only comment on tasks
  VIEW = "VIEW"        // Read-only access
}

export interface ISpaceMember extends Document {
  user: Schema.Types.ObjectId;
  space: Schema.Types.ObjectId;
  workspace: Schema.Types.ObjectId; // Denormalized for performance
  permissionLevel: SpacePermissionLevel;
  addedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const spaceMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: Object.values(SpacePermissionLevel),
      required: true,
      default: SpacePermissionLevel.EDIT
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

// Unique constraint: one permission level per user per space
spaceMemberSchema.index({ user: 1, space: 1 }, { unique: true });

// Performance indexes
spaceMemberSchema.index({ space: 1 });
spaceMemberSchema.index({ user: 1 });
spaceMemberSchema.index({ workspace: 1 });

module.exports = mongoose.models.SpaceMember || mongoose.model("SpaceMember", spaceMemberSchema);
export {};
