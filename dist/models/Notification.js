"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const notificationSchema = new mongoose_1.Schema({
    recipient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: [
            "TASK_ASSIGNED",
            "TASK_UPDATE",
            "TASK_STATUS_CHANGED",
            "TASK_PRIORITY_CHANGED",
            "COMMENT_ADDED",
            "COMMENT_UPDATED",
            "COMMENT_DELETED",
            "COMMENT_MENTION",
            "DM_NEW",
            "FILE_UPLOAD",
            "INVITATION",
            "INVITE_ACCEPTED",
            "SPACE_INVITATION",
            "SYSTEM"
        ],
        required: true,
    },
    title: {
        type: String,
        required: true,
        maxlength: 200,
    },
    body: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    read: {
        type: Boolean,
        default: false,
        index: true,
    },
    readAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
// Compound indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
const Notification = (0, mongoose_1.model)("Notification", notificationSchema);
module.exports = Notification;
