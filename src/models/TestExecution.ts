const mongoose = require("mongoose");

const stepResultSchema = new mongoose.Schema({
  result: { type: String, enum: ["not_run", "pass", "fail", "blocked", "skipped"], required: true },
  actualResult: { type: String, trim: true, maxlength: 4000 },
  evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
}, { _id: false });

const historySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  previousResult: { type: String, required: true },
  result: { type: String, required: true },
  reason: String,
  stepResults: [stepResultSchema],
  evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  at: { type: Date, required: true },
}, { _id: false });

const testExecutionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "QaProject" },
  run: { type: mongoose.Schema.Types.ObjectId, ref: "TestRun", required: true },
  testCase: { type: mongoose.Schema.Types.ObjectId, ref: "TestCase", required: true },
  caseKey: { type: String, required: true },
  revision: { type: Number, required: true, min: 1 },
  revisionId: { type: mongoose.Schema.Types.ObjectId, ref: "TestCaseRevision", required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  result: { type: String, enum: ["not_run", "pass", "fail", "blocked", "skipped"], default: "not_run" },
  reason: { type: String, trim: true, maxlength: 4000 },
  stepResults: [stepResultSchema],
  evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attachment" }],
  version: { type: Number, default: 1, min: 1 },
  history: [historySchema],
  bugIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

testExecutionSchema.index({ workspace: 1, run: 1, testCase: 1 }, { unique: true });
testExecutionSchema.index({ workspace: 1, project: 1, assignedTo: 1, result: 1, updatedAt: -1 });
testExecutionSchema.index({ workspace: 1, project: 1, run: 1, result: 1 });
module.exports = mongoose.models.TestExecution || mongoose.model("TestExecution", testExecutionSchema);
export {};
