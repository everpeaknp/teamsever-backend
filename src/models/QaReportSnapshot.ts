const mongoose = require("mongoose");

const qaReportSnapshotSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "TestPlan", required: true, immutable: true },
  report: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  signedAt: { type: Date, required: true, immutable: true },
  exceptionReason: { type: String, trim: true, maxlength: 4000, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

qaReportSnapshotSchema.index({ workspace: 1, plan: 1, createdAt: -1 });
module.exports = mongoose.models.QaReportSnapshot || mongoose.model("QaReportSnapshot", qaReportSnapshotSchema);
export {};
