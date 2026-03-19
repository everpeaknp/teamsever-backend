"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: false, // Optional for DMs
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "CHAT_MESSAGE_CREATED"]
    },
    resourceType: {
        type: String,
        required: true,
        enum: ["Workspace", "Space", "List", "Task", "ChatMessage", "Notification", "TaskComment", "DirectMessage", "CustomField", "TaskDependency", "TimeEntry"]
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});
// Indexes
activityLogSchema.index({ workspaceId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model("ActivityLog", activityLogSchema);
