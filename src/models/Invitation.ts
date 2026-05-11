const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      // Not required when inviteType is "link"
      lowercase: true,
      trim: true,
      default: null
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      required: true,
      default: "member"
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
      enum: ["pending", "accepted", "expired"],
      default: "pending"
    },
    expiresAt: {
      type: Date,
      required: true
    },
    // --- Fast-Pass fields (all optional) ---
    inviteType: {
      type: String,
      enum: ["email", "link"],
      default: "email"
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      default: null
    },
    spacePermissionLevel: {
      type: String,
      enum: ["FULL", "EDIT", "COMMENT", "VIEW"],
      default: "EDIT"
    }
  },
  {
    timestamps: true
  }
);

// TTL index - MongoDB will automatically delete documents after expiresAt
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for faster queries
invitationSchema.index({ workspaceId: 1, email: 1, status: 1 });
invitationSchema.index({ token: 1, status: 1 });

module.exports = mongoose.model("Invitation", invitationSchema);

export {};
