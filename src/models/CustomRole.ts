import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface ICustomRole extends Document {
  name: string;
  label: string;
  color: string;
  workspace: Schema.Types.ObjectId;
  permissions: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide role name"],
      trim: true,
      maxlength: [50, "Role name cannot exceed 50 characters"]
    },
    label: {
      type: String,
      required: [true, "Please provide role label"],
      trim: true,
      maxlength: [30, "Label cannot exceed 30 characters"]
    },
    color: {
      type: String,
      default: "#3B82F6", 
      trim: true
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    permissions: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"]
    }
  },
  {
    timestamps: true
  }
);

customRoleSchema.index({ workspace: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("CustomRole", customRoleSchema);
export {};
