"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const customFieldValueSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true
    },
    customField: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomField",
        required: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, {
    timestamps: true
});
// Indexes for performance
customFieldValueSchema.index({ task: 1, customField: 1 }, { unique: true });
customFieldValueSchema.index({ customField: 1 });
module.exports = mongoose.model("CustomFieldValue", customFieldValueSchema);
