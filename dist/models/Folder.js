"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const folderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Folder name is required"],
        trim: true,
        maxlength: [100, "Folder name cannot exceed 100 characters"]
    },
    spaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space",
        required: true
    },
    color: {
        type: String,
        default: "#3b82f6"
    },
    icon: {
        type: String,
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
// Indexes
folderSchema.index({ spaceId: 1, isDeleted: 1 });
module.exports = mongoose.model("Folder", folderSchema);
