const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  timeEntry: { type: mongoose.Schema.Types.ObjectId, ref: "TimeEntry", required: true, index: true },
  areaId: { type: mongoose.Schema.Types.ObjectId },
  mode: { type: String, enum: ["onsite", "remote"], required: true },
  status: { type: String, enum: ["inside", "outside", "unavailable"], required: true },
  observedAt: { type: Date, required: true },
  receivedAt: { type: Date, default: Date.now, required: true },
  accuracyMeters: { type: Number, min: 0 },
  distanceMeters: { type: Number, min: 0 },
  activeReviewFlag: { type: Boolean, default: false, required: true },
  reason: { type: String, maxlength: 120 }
}, { timestamps: true });
schema.index({ timeEntry: 1, activeReviewFlag: 1 }, { unique: true, partialFilterExpression: { activeReviewFlag: true } });
schema.index({ workspace: 1, user: 1, receivedAt: -1 });
module.exports = mongoose.model("AttendanceLocationEvent", schema);
export {};
