"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpacePermissionLevel = void 0;
const mongoose = require("mongoose");
/**
 * Space Permission Levels
 * Defines granular access control at the space level
 */
var SpacePermissionLevel;
(function (SpacePermissionLevel) {
    SpacePermissionLevel["FULL"] = "FULL";
    SpacePermissionLevel["EDIT"] = "EDIT";
    SpacePermissionLevel["COMMENT"] = "COMMENT";
    SpacePermissionLevel["VIEW"] = "VIEW"; // Read-only access
})(SpacePermissionLevel || (exports.SpacePermissionLevel = SpacePermissionLevel = {}));
const spaceMemberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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
        enum: Object.values(SpacePermissionLevel),
        required: true,
        default: SpacePermissionLevel.EDIT
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});
// Unique constraint: one permission level per user per space
spaceMemberSchema.index({ user: 1, space: 1 }, { unique: true });
// Performance indexes
spaceMemberSchema.index({ space: 1 });
spaceMemberSchema.index({ user: 1 });
spaceMemberSchema.index({ workspace: 1 });
module.exports = mongoose.models.SpaceMember || mongoose.model("SpaceMember", spaceMemberSchema);
