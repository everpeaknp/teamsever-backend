const mongoose = require("mongoose");

const testRunSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "QaProject" },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "TestPlan", required: true },
  build: { type: String, required: true, trim: true, maxlength: 120 },
  environment: { type: String, required: true, trim: true, maxlength: 240 },
  platform: { type: String, trim: true, maxlength: 120 },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  closedAt: Date,
}, { timestamps: true });

testRunSchema.index({ workspace: 1, project: 1, plan: 1, createdAt: -1 });
testRunSchema.index({ workspace: 1, project: 1, status: 1, createdAt: -1 });
module.exports = mongoose.models.TestRun || mongoose.model("TestRun", testRunSchema);
export {};
