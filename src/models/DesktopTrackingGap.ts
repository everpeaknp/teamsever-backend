import mongoose from "mongoose";

const desktopTrackingGapSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  timeEntry: { type: mongoose.Schema.Types.ObjectId, ref: "TimeEntry", required: true, index: true },
  device: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedAttendanceDevice", required: true },
  gapStartedAt: { type: Date, required: true },
  gapEndedAt: { type: Date, required: true },
  reason: { type: String, enum: ["presence_heartbeat_missing"], default: "presence_heartbeat_missing" },
}, { timestamps: true });

desktopTrackingGapSchema.index({ timeEntry: 1, gapStartedAt: 1 }, { unique: true });
desktopTrackingGapSchema.index({ workspace: 1, user: 1, gapStartedAt: -1, _id: -1 });
module.exports = mongoose.model("DesktopTrackingGap", desktopTrackingGapSchema);
