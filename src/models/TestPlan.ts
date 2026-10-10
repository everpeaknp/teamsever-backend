const mongoose = require("mongoose");

const testPlanSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 4000 },
  caseIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "TestCase" }], required: true },
  status: { type: String, enum: ["draft", "active", "archived"], default: "draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

testPlanSchema.index({ workspace: 1, status: 1, updatedAt: -1 });
module.exports = mongoose.models.TestPlan || mongoose.model("TestPlan", testPlanSchema);
export {};
