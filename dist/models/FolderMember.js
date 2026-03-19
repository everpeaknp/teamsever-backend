"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderPermissionLevel = void 0;
const mongoose = require("mongoose");
/**
 * Folder Permission Levels
 * Defines granular access control at the folder level
 */
var FolderPermissionLevel;
(function (FolderPermissionLevel) {
    FolderPermissionLevel["FULL"] = "FULL";
    FolderPermissionLevel["EDIT"] = "EDIT";
    FolderPermissionLevel["COMMENT"] = "COMMENT";
    FolderPermissionLevel["VIEW"] = "VIEW"; // Read-only access
})(FolderPermissionLevel || (exports.FolderPermissionLevel = FolderPermissionLevel = {}));
const folderMemberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        required: true
    },
    space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space",
        required: true
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    permissionLevel: {
        type: String,
        enum: Object.values(FolderPermissionLevel),
        required: true,
        default: FolderPermissionLevel.EDIT
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});
// Unique constraint: one permission level per user per folder
folderMemberSchema.index({ user: 1, folder: 1 }, { unique: true });
// Performance indexes
folderMemberSchema.index({ folder: 1 });
folderMemberSchema.index({ user: 1 });
folderMemberSchema.index({ space: 1 });
folderMemberSchema.index({ workspace: 1 });
module.exports = mongoose.models.FolderMember || mongoose.model("FolderMember", folderMemberSchema);
