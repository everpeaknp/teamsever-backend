"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const timeEntrySchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Please provide user"]
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Space",
        required: false
    },
    startTime: {
        type: Date,
        required: [true, "Please provide start time"]
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    description: {
        type: String,
        maxlength: [500, "Description cannot exceed 500 characters"]
    },
    isRunning: {
        type: Boolean,
        default: true
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
timeEntrySchema.index({ task: 1, isDeleted: 1 });
timeEntrySchema.index({ user: 1, isRunning: 1 });
timeEntrySchema.index({ workspace: 1, isDeleted: 1 });
timeEntrySchema.index({ project: 1, isDeleted: 1 });
timeEntrySchema.index({ startTime: 1 });
timeEntrySchema.index({ endTime: 1 });
// Calculate duration before saving if endTime is set
timeEntrySchema.pre("save", function () {
    if (this.endTime && this.startTime) {
        const durationMs = this.endTime.getTime() - this.startTime.getTime();
        this.duration = Math.floor(durationMs / 1000); // Convert to seconds
    }
});
module.exports = mongoose.model("TimeEntry", timeEntrySchema);
