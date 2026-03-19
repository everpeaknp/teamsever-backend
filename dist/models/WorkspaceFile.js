"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const workspaceFileSchema = new mongoose_1.Schema({
    workspace: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
        trim: true,
    },
    originalName: {
        type: String,
        required: true,
        trim: true,
    },
    fileType: {
        type: String,
        required: true,
    },
    fileSize: {
        type: Number,
        required: true,
    },
    cloudinaryUrl: {
        type: String,
        required: true,
    },
    cloudinaryPublicId: {
        type: String,
        required: true,
    },
    resourceType: {
        type: String,
        required: true,
        enum: ["image", "video", "raw", "auto"],
    },
    format: {
        type: String,
        required: true,
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
// Compound indexes for efficient queries
workspaceFileSchema.index({ workspace: 1, isDeleted: 1, createdAt: -1 });
workspaceFileSchema.index({ uploadedBy: 1, createdAt: -1 });
const WorkspaceFile = (0, mongoose_1.model)("WorkspaceFile", workspaceFileSchema);
module.exports = WorkspaceFile;
