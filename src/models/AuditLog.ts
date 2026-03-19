import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface IAuditLog extends Document {
  userId: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  resourceType: string;
  resourceId: Schema.Types.ObjectId;
  oldValue: any;
  newValue: any;
  changedFields: string[];
  createdAt: Date;
}

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    resourceType: {
      type: String,
      required: true,
      enum: ["Workspace", "Space", "List", "Task", "ChatMessage", "TaskComment"]
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    changedFields: [String]
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Indexes
auditLogSchema.index({ workspaceId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
export {};
