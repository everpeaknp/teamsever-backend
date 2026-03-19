"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const { Schema } = mongoose;
const directMessageSchema = new Schema({
    conversation: {
        type: Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        required: true,
        maxlength: 5000,
    },
    readBy: {
        type: [Schema.Types.ObjectId],
        ref: "User",
        default: [],
    },
}, {
    timestamps: true,
});
// Compound index for efficient message queries (chat-style ASC)
directMessageSchema.index({ conversation: 1, createdAt: 1 });
module.exports = mongoose.model("DirectMessage", directMessageSchema);
