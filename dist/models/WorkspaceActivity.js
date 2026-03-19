"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
/**
 * WorkspaceActivity Model
 * Tracks workspace-level activities like space/list creation, member additions, etc.
 */
const workspaceActivitySchema = new mongoose.Schema({
    // Workspace reference
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    // User who performed the action
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Activity type
    type: {
        type: String,
        enum: [
            "workspace_created",
            "workspace_updated",
            "member_joined",
            "member_added",
            "member_removed",
            "member_role_changed",
            "space_created",
            "space_updated",
            "space_deleted",
            "list_created",
            "list_updated",
            "list_deleted",
            "space_member_added",
            "space_member_removed",
            "list_member_added",
            "list_member_removed",
        ],
        required: true,
        index: true,
    },
    // Description of the activity
    description: {
        type: String,
        required: true,
    },
    // Resource references
    space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space",
    },
    list: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "List",
    },
    // Target user (for member-related activities)
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Indexes for efficient queries
workspaceActivitySchema.index({ workspace: 1, createdAt: -1 });
workspaceActivitySchema.index({ user: 1, createdAt: -1 });
workspaceActivitySchema.index({ type: 1, createdAt: -1 });
workspaceActivitySchema.index({ isDeleted: 1 });
// Static method to get workspace activity feed
workspaceActivitySchema.statics.getWorkspaceActivity = function (workspaceId, options = {}) {
    const query = {
        workspace: workspaceId,
        isDeleted: false,
    };
    if (options.type) {
        query.type = options.type;
    }
    return this.find(query)
        .populate("user", "name email avatar")
        .populate("targetUser", "name email avatar")
        .populate("space", "name")
        .populate("list", "name")
        .sort({ createdAt: -1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0)
        .lean();
};
// Static method to create workspace activity
workspaceActivitySchema.statics.createActivity = async function (data) {
    const activity = await this.create(data);
    return Array.isArray(activity) ? activity[0] : activity;
};
const WorkspaceActivity = mongoose.model("WorkspaceActivity", workspaceActivitySchema);
module.exports = WorkspaceActivity;
