"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const taskCommentSchema = new mongoose_1.Schema({
    task: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
        index: true,
    },
    author: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 5000,
    },
    mentions: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: "User",
        default: [],
    },
    edited: {
        type: Boolean,
        default: false,
    },
    editedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
// Indexes for efficient queries
taskCommentSchema.index({ task: 1, createdAt: 1 });
const TaskComment = (0, mongoose_1.model)("TaskComment", taskCommentSchema);
module.exports = TaskComment;
