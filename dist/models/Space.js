"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const spaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide space name"],
        trim: true,
        maxlength: [100, "Space name cannot exceed 100 characters"]
    },
    description: {
        type: String,
        maxlength: [500, "Description cannot exceed 500 characters"]
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    members: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            role: {
                type: String,
                enum: ["owner", "admin", "member"],
                default: "member"
            }
        }
    ],
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
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
spaceSchema.index({ workspace: 1, isDeleted: 1 });
spaceSchema.index({ owner: 1, isDeleted: 1 });
spaceSchema.index({ "members.user": 1, isDeleted: 1 });
module.exports = mongoose.model("Space", spaceSchema);
