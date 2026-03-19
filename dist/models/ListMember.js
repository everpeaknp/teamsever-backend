"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPermissionLevel = void 0;
const mongoose = require("mongoose");
/**
 * List Permission Levels
 * Defines granular access control at the list level
 */
var ListPermissionLevel;
(function (ListPermissionLevel) {
    ListPermissionLevel["FULL"] = "FULL";
    ListPermissionLevel["EDIT"] = "EDIT";
    ListPermissionLevel["COMMENT"] = "COMMENT";
    ListPermissionLevel["VIEW"] = "VIEW"; // Read-only access
})(ListPermissionLevel || (exports.ListPermissionLevel = ListPermissionLevel = {}));
const listMemberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    list: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "List",
        required: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        default: null
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
        enum: Object.values(ListPermissionLevel),
        required: true,
        default: ListPermissionLevel.EDIT
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});
// Unique constraint: one permission level per user per list
listMemberSchema.index({ user: 1, list: 1 }, { unique: true });
// Performance indexes
listMemberSchema.index({ list: 1 });
listMemberSchema.index({ user: 1 });
listMemberSchema.index({ folder: 1 });
listMemberSchema.index({ space: 1 });
listMemberSchema.index({ workspace: 1 });
const ListMember = mongoose.models.ListMember ||
    mongoose.model("ListMember", listMemberSchema);
module.exports = {
    ListMember,
    ListPermissionLevel,
};
