import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface ISpaceInvitation extends Document {
  email: string;
  userId: Schema.Types.ObjectId | null; // null if user doesn't exist yet
  spaceId: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  permissionLevel: "FULL" | "EDIT" | "COMMENT" | "VIEW";
  invitedBy: Schema.Types.ObjectId;
  token: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const spaceInvitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    permissionLevel: {
      type: String,
      enum: ["FULL", "EDIT", "COMMENT", "VIEW"],
      required: true,
      default: "EDIT"
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending"
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index - MongoDB will automatically delete documents after expiresAt
spaceInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for faster queries
spaceInvitationSchema.index({ spaceId: 1, email: 1, status: 1 });
spaceInvitationSchema.index({ spaceId: 1, userId: 1, status: 1 });
spaceInvitationSchema.index({ token: 1, status: 1 });
spaceInvitationSchema.index({ workspaceId: 1, status: 1 });

module.exports = mongoose.models.SpaceInvitation || mongoose.model("SpaceInvitation", spaceInvitationSchema);
export {};
