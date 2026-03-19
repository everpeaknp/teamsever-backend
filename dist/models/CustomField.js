"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const customFieldSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide custom field name"],
        trim: true,
        maxlength: [100, "Custom field name cannot exceed 100 characters"]
    },
    type: {
        type: String,
        enum: ["text", "number", "date", "dropdown", "checkbox", "user"],
        required: [true, "Please provide custom field type"]
    },
    options: [String],
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    }
}, {
    timestamps: true
});
// Indexes for performance
customFieldSchema.index({ workspace: 1, isDeleted: 1 });
customFieldSchema.index({ project: 1, isDeleted: 1 });
customFieldSchema.index({ type: 1 });
module.exports = mongoose.model("CustomField", customFieldSchema);
