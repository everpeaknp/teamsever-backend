const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
      maxlength: [100, "Folder name cannot exceed 100 characters"]
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    color: {
      type: String,
      default: "#3b82f6"
    },
    icon: {
      type: String,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    githubWebhookSecret: {
      type: String,
      select: false // DO NOT return the secret in regular queries for security
    },
    githubRepoName: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes
folderSchema.index({ spaceId: 1, isDeleted: 1 });

module.exports = mongoose.model("Folder", folderSchema);

export {};
