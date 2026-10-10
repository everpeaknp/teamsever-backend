const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true, maxlength: 4000 },
  testData: { type: String, trim: true, maxlength: 4000 },
  expectedResult: { type: String, required: true, trim: true, maxlength: 4000 },
}, { _id: false });

const testCaseSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  key: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "QaModule" },
  suiteId: { type: mongoose.Schema.Types.ObjectId, ref: "TestSuite" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  type: { type: String, enum: ["manual", "automated"], default: "manual" },
  state: { type: String, enum: ["draft", "active", "retired"], default: "draft" },
  preconditions: { type: String, trim: true, maxlength: 8000 },
  steps: { type: [stepSchema], required: true, validate: [(value: unknown[]) => value.length > 0, "At least one step is required"] },
  linkedTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  currentRevision: { type: Number, required: true, min: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

testCaseSchema.index({ workspace: 1, key: 1 }, { unique: true });
testCaseSchema.index({ workspace: 1, state: 1, updatedAt: -1, _id: -1 });
testCaseSchema.index({ workspace: 1, moduleId: 1, state: 1, updatedAt: -1 });
testCaseSchema.index({ workspace: 1, suiteId: 1, state: 1, updatedAt: -1 });

module.exports = mongoose.models.TestCase || mongoose.model("TestCase", testCaseSchema);
export {};
