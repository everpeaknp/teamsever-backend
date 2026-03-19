import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export enum TablePermissionLevel {
  FULL = "FULL", // Full access - create, edit, delete rows/columns
  EDIT = "EDIT", // Can edit cell values only
  VIEW = "VIEW", // Read-only access
}

export interface ITableMember extends Document {
  user: Schema.Types.ObjectId;
  table: Schema.Types.ObjectId;
  space: Schema.Types.ObjectId;
  workspace: Schema.Types.ObjectId;
  permissionLevel: TablePermissionLevel;
  addedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tableMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomTable",
      required: true,
    },
    space: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    permissionLevel: {
      type: String,
      enum: Object.values(TablePermissionLevel),
      required: true,
      default: TablePermissionLevel.FULL,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: one permission level per user per table
tableMemberSchema.index({ user: 1, table: 1 }, { unique: true });

// Performance indexes
tableMemberSchema.index({ table: 1 });
tableMemberSchema.index({ user: 1 });
tableMemberSchema.index({ space: 1 });
tableMemberSchema.index({ workspace: 1 });

const TableMember = mongoose.models.TableMember ||
  mongoose.model("TableMember", tableMemberSchema);

module.exports = {
  TableMember,
  TablePermissionLevel,
};

export {};
