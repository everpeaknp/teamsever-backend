const mongoose = require("mongoose");

const testCaseRevisionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "QaProject", immutable: true },
  testCase: { type: mongoose.Schema.Types.ObjectId, ref: "TestCase", required: true, immutable: true },
  revision: { type: Number, required: true, min: 1, immutable: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" });

testCaseRevisionSchema.index({ workspace: 1, testCase: 1, revision: 1 }, { unique: true });

module.exports = mongoose.models.TestCaseRevision || mongoose.model("TestCaseRevision", testCaseRevisionSchema);
export {};
