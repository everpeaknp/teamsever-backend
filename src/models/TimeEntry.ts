import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface ITimeEntry extends Document {
  task?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  workspace: Schema.Types.ObjectId;
  project?: Schema.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  description?: string;
  isRunning: boolean;
  attendanceMode?: "onsite" | "remote";
  clockInAreaId?: Schema.Types.ObjectId;
  clockInVerificationMethod?: "gps" | "network_confirmed";
  clockInSource?: "web" | "desktop";
  clockOutSource?: "web" | "desktop";
  clockInDevice?: Schema.Types.ObjectId;
  clockOutDevice?: Schema.Types.ObjectId;
  desktopPresenceDevice?: Schema.Types.ObjectId;
  desktopPresenceConsentedAt?: Date;
  clockInLocation?: { latitude: number; longitude: number; accuracyMeters: number; capturedAt: Date; areaName?: string };
  clockOutLocation?: { latitude: number; longitude: number; accuracyMeters: number; capturedAt: Date; distanceFromClockInMeters?: number; withinRange: boolean };
  locationReviewReason?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new mongoose.Schema(
  {
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
    attendanceMode: { type: String, enum: ["onsite", "remote"] },
    clockInAreaId: { type: mongoose.Schema.Types.ObjectId },
    clockInVerificationMethod: { type: String, enum: ["gps", "network_confirmed"] },
    clockInSource: { type: String, enum: ["web", "desktop"], default: "web" },
    clockOutSource: { type: String, enum: ["web", "desktop"] },
    clockInDevice: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedAttendanceDevice" },
    clockOutDevice: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedAttendanceDevice" },
    desktopPresenceDevice: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedAttendanceDevice" },
    desktopPresenceConsentedAt: { type: Date },
    clockInLocation: { type: { latitude: Number, longitude: Number, accuracyMeters: Number, capturedAt: Date, areaName: String }, select: false },
    clockOutLocation: { type: { latitude: Number, longitude: Number, accuracyMeters: Number, capturedAt: Date, distanceFromClockInMeters: Number, withinRange: Boolean }, select: false },
    locationReviewReason: { type: String, maxlength: 160 },
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
  },
  {
    timestamps: true
  }
);

// Indexes for performance
timeEntrySchema.index({ task: 1, isDeleted: 1 });
timeEntrySchema.index({ user: 1, isRunning: 1 });
timeEntrySchema.index({ workspace: 1, isDeleted: 1 });
timeEntrySchema.index({ project: 1, isDeleted: 1 });
timeEntrySchema.index({ startTime: 1 });
timeEntrySchema.index({ endTime: 1 });
timeEntrySchema.index({ user: 1, workspace: 1, isRunning: 1, isDeleted: 1 }); // Performance check for active timers
timeEntrySchema.index({ desktopPresenceDevice: 1, isRunning: 1, isDeleted: 1 });

// Calculate duration before saving if endTime is set
timeEntrySchema.pre("save", function (this: ITimeEntry) {
  if (this.endTime && this.startTime) {
    const durationMs = this.endTime.getTime() - this.startTime.getTime();
    this.duration = Math.floor(durationMs / 1000); // Convert to seconds
  }
});

module.exports = mongoose.model("TimeEntry", timeEntrySchema);
export {};
