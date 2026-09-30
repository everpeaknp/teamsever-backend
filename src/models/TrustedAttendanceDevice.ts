import mongoose from "mongoose";

const trustedAttendanceDeviceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  platform: { type: String, enum: ["windows", "linux"], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  activityMonitoringEnabled: { type: Boolean, default: false },
  activityMonitoringEnabledAt: { type: Date, default: null },
  lastSeenAt: { type: Date },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });

trustedAttendanceDeviceSchema.index({ user: 1, revokedAt: 1 });
module.exports = mongoose.model("TrustedAttendanceDevice", trustedAttendanceDeviceSchema);
