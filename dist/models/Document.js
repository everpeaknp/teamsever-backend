"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Please provide document title"],
        trim: true,
        maxlength: [200, "Document title cannot exceed 200 characters"],
        default: "Untitled"
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        default: {
            type: "doc",
            content: []
        }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        default: null // null means private document
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null
    },
    coverImage: {
        type: String,
        default: null
    },
    icon: {
        type: String,
        default: "📄"
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    collaborators: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            permission: {
                type: String,
                enum: ["view", "edit"],
                default: "view"
            }
        }]
}, {
    timestamps: true
});
// Indexes for performance
documentSchema.index({ owner: 1, isArchived: 1 });
documentSchema.index({ workspace: 1, isArchived: 1 });
documentSchema.index({ parentId: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ title: "text" }); // Text search on title
module.exports = mongoose.models.Document || mongoose.model("Document", documentSchema);
