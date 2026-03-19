"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
/**
 * Activity Model
 * Tracks both user comments and system-generated updates for tasks
 */
const activitySchema = new mongoose.Schema({
    // Task reference
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
        index: true,
    },
    // User who performed the action or wrote the comment
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Activity type
    type: {
        type: String,
        enum: ["comment", "update"],
        required: true,
        index: true,
    },
    // Content for comments or description of change
    content: {
        type: String,
        required: function () {
            return this.type === "comment";
        },
    },
    // For updates: which field was changed
    fieldChanged: {
        type: String,
        enum: [
            "status",
            "assignee",
            "priority",
            "dueDate",
            "startDate",
            "title",
            "description",
            "list",
            "dependencies",
            "subtasks",
            "customFields",
            "milestone",
        ],
        required: function () {
            return this.type === "update";
        },
    },
    // Previous value
    oldValue: {
        type: mongoose.Schema.Types.Mixed,
    },
    // New value
    newValue: {
        type: mongoose.Schema.Types.Mixed,
    },
    // Whether this was system-generated or user-initiated
    isSystemGenerated: {
        type: Boolean,
        default: false,
    },
    // Workspace for access control
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    // Mentions in comments
    mentions: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    // Reactions to comments
    reactions: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            emoji: {
                type: String,
                enum: ["👍", "❤️", "😄", "🎉", "👀", "🚀"],
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
}, {
    timestamps: true,
});
// Indexes for efficient queries
activitySchema.index({ task: 1, createdAt: -1 });
activitySchema.index({ task: 1, type: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ isDeleted: 1 });
// Virtual for formatted change description
activitySchema.virtual("changeDescription").get(function () {
    if (this.type !== "update")
        return null;
    const fieldLabels = {
        status: "Status",
        assignee: "Assignee",
        priority: "Priority",
        dueDate: "Due Date",
        startDate: "Start Date",
        title: "Title",
        description: "Description",
        list: "List",
        dependencies: "Dependencies",
        subtasks: "Subtasks",
        customFields: "Custom Fields",
        milestone: "Milestone",
    };
    const field = fieldLabels[this.fieldChanged] || this.fieldChanged;
    const oldVal = this.formatValue(this.oldValue, this.fieldChanged);
    const newVal = this.formatValue(this.newValue, this.fieldChanged);
    return `${field} changed from "${oldVal}" to "${newVal}"`;
});
// Method to format values for display
activitySchema.methods.formatValue = function (value, field) {
    if (value === null || value === undefined)
        return "None";
    switch (field) {
        case "assignee":
            return value?.name || value?.email || "Unassigned";
        case "dueDate":
        case "startDate":
            return value ? new Date(value).toLocaleDateString() : "None";
        case "milestone":
            return value ? "Yes" : "No";
        case "dependencies":
        case "subtasks":
            return Array.isArray(value) ? `${value.length} items` : "None";
        default:
            return String(value);
    }
};
// Method to soft delete
activitySchema.methods.softDelete = async function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return await this.save();
};
// Method to add reaction
activitySchema.methods.addReaction = async function (userId, emoji) {
    // Remove existing reaction from this user
    this.reactions = this.reactions.filter((r) => r.user.toString() !== userId);
    // Add new reaction
    this.reactions.push({
        user: userId,
        emoji,
        createdAt: new Date(),
    });
    return await this.save();
};
// Method to remove reaction
activitySchema.methods.removeReaction = async function (userId) {
    this.reactions = this.reactions.filter((r) => r.user.toString() !== userId);
    return await this.save();
};
// Static method to get task activity feed
activitySchema.statics.getTaskActivity = function (taskId, options = {}) {
    const query = {
        task: taskId,
        isDeleted: false,
    };
    if (options.type) {
        query.type = options.type;
    }
    return this.find(query)
        .populate("user", "name email avatar")
        .populate("mentions", "name email")
        .populate({
        path: "reactions.user",
        select: "name email",
    })
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0)
        .lean();
};
// Static method to get user activity
activitySchema.statics.getUserActivity = function (userId, workspaceId, options = {}) {
    return this.find({
        user: userId,
        workspace: workspaceId,
        isDeleted: false,
    })
        .populate("task", "title status")
        .populate("user", "name email avatar")
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0)
        .lean();
};
// Static method to create activity for field change
activitySchema.statics.createUpdateActivity = async function (taskId, userId, workspaceId, fieldChanged, oldValue, newValue, isSystemGenerated = false) {
    const activity = await this.create({
        task: taskId,
        user: userId,
        workspace: workspaceId,
        type: "update",
        fieldChanged,
        oldValue,
        newValue,
        isSystemGenerated,
    });
    // Return the document
    return Array.isArray(activity) ? activity[0] : activity;
};
// Static method to create comment activity
activitySchema.statics.createCommentActivity = async function (taskId, userId, workspaceId, content, mentions = []) {
    const activity = await this.create({
        task: taskId,
        user: userId,
        workspace: workspaceId,
        type: "comment",
        content,
        mentions,
        isSystemGenerated: false,
    });
    // Return the document (create returns an array if passed array, single doc otherwise)
    return Array.isArray(activity) ? activity[0] : activity;
};
const Activity = mongoose.model("Activity", activitySchema);
module.exports = Activity;
