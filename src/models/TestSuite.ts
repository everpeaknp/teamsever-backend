const mongoose = require("mongoose");

const testSuiteSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "QaProject" },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: "QaModule" },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000 },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

testSuiteSchema.index({ workspace: 1, project: 1, isArchived: 1, name: 1 });
testSuiteSchema.index({ workspace: 1, project: 1, moduleId: 1, isArchived: 1 });

module.exports = mongoose.models.TestSuite || mongoose.model("TestSuite", testSuiteSchema);
export {};
