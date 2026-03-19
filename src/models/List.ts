import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface IListMember {
  user: Schema.Types.ObjectId;
  role: "owner" | "admin" | "member";
}

export interface IList extends Document {
  name: string;
  space: Schema.Types.ObjectId;
  workspace: Schema.Types.ObjectId; // Denormalized for performance
  folderId?: Schema.Types.ObjectId; // Optional folder reference
  createdBy: Schema.Types.ObjectId;
  members: IListMember[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const listSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide list name"],
      trim: true,
      maxlength: [100, "List name cannot exceed 100 characters"]
    },
    space: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        role: {
          type: String,
          enum: ["owner", "admin", "member"],
          default: "member"
        }
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
listSchema.index({ space: 1, isDeleted: 1 });
listSchema.index({ folderId: 1, isDeleted: 1 });
listSchema.index({ workspace: 1, isDeleted: 1 });
listSchema.index({ createdBy: 1, isDeleted: 1 });
listSchema.index({ "members.user": 1, isDeleted: 1 });

module.exports = mongoose.model("List", listSchema);
export {};
