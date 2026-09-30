import mongoose from "mongoose";

const desktopAppPresenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  timeEntry: { type: mongoose.Schema.Types.ObjectId, ref: "TimeEntry", required: true, index: true },
  device: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedAttendanceDevice", required: true },
  appId: { type: String, required: true, maxlength: 160 },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
}, { timestamps: true });

desktopAppPresenceSchema.index({ timeEntry: 1, startedAt: 1 });
module.exports = mongoose.model("DesktopAppPresence", desktopAppPresenceSchema);
