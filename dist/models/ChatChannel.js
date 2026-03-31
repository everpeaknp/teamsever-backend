"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const chatChannelSchema = new mongoose_1.Schema({
    workspace: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    type: {
        type: String,
        enum: ["public", "private"],
        default: "public",
        index: true,
    },
    members: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
    },
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
// Indexes
chatChannelSchema.index({ workspace: 1, name: 1 }, { unique: true });
chatChannelSchema.index({ workspace: 1, isDeleted: 1 });
const ChatChannel = (0, mongoose_1.model)("ChatChannel", chatChannelSchema);
module.exports = ChatChannel;
