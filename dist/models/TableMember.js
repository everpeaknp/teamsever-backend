"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablePermissionLevel = void 0;
const mongoose = require("mongoose");
var TablePermissionLevel;
(function (TablePermissionLevel) {
    TablePermissionLevel["FULL"] = "FULL";
    TablePermissionLevel["EDIT"] = "EDIT";
    TablePermissionLevel["VIEW"] = "VIEW";
})(TablePermissionLevel || (exports.TablePermissionLevel = TablePermissionLevel = {}));
const tableMemberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomTable",
        required: true,
    },
    space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space",
        required: true,
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
    },
    permissionLevel: {
        type: String,
        enum: Object.values(TablePermissionLevel),
        required: true,
        default: TablePermissionLevel.FULL,
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, {
    timestamps: true,
});
// Unique constraint: one permission level per user per table
tableMemberSchema.index({ user: 1, table: 1 }, { unique: true });
// Performance indexes
tableMemberSchema.index({ table: 1 });
tableMemberSchema.index({ user: 1 });
tableMemberSchema.index({ space: 1 });
tableMemberSchema.index({ workspace: 1 });
const TableMember = mongoose.models.TableMember ||
    mongoose.model("TableMember", tableMemberSchema);
module.exports = {
    TableMember,
    TablePermissionLevel,
};
