"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceRole = void 0;
const mongoose = require("mongoose");
// Workspace roles - matches permission system
var WorkspaceRole;
(function (WorkspaceRole) {
    WorkspaceRole["OWNER"] = "owner";
    WorkspaceRole["ADMIN"] = "admin";
    WorkspaceRole["MEMBER"] = "member";
    WorkspaceRole["GUEST"] = "guest";
})(WorkspaceRole || (exports.WorkspaceRole = WorkspaceRole = {}));
const workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide workspace name"],
        trim: true,
        maxlength: [100, "Workspace name cannot exceed 100 characters"]
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
                enum: ["owner", "admin", "member", "guest"],
                default: "member"
            },
            status: {
                type: String,
                enum: ["active", "inactive"],
                default: "active" // Changed from "inactive" to "active"
            },
            customRoleTitle: {
                type: String,
                trim: true,
                maxlength: [50, "Custom role title cannot exceed 50 characters"],
                default: null
            }
        }
    ],
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    lastAnnouncementTime: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});
// Index for faster queries
workspaceSchema.index({ owner: 1, isDeleted: 1 });
workspaceSchema.index({ "members.user": 1, isDeleted: 1 });
module.exports = mongoose.model("Workspace", workspaceSchema);
