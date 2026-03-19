"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const chatMessageSchema = new mongoose_1.Schema({
    workspace: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000,
    },
    type: {
        type: String,
        enum: ["text", "system"],
        default: "text",
    },
    mentions: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    isDeleted: {
        type: Boolean,
        default: false,
        index: true,
    },
    deletedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Compound indexes for efficient queries
chatMessageSchema.index({ workspace: 1, createdAt: -1 });
chatMessageSchema.index({ workspace: 1, isDeleted: 1, createdAt: -1 });
const ChatMessage = (0, mongoose_1.model)("ChatMessage", chatMessageSchema);
module.exports = ChatMessage;
