const mongoose = require("mongoose");

const qaProjectSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  space: { type: mongoose.Schema.Types.ObjectId, ref: "Space", default: null },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  scopeType: { type: String, enum: ["workspace", "folder"], required: true },
  settingsOverrides: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  caseSequence: { type: Number, default: 0, min: 0 },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

qaProjectSchema.index({ workspace: 1, scopeType: 1, folder: 1 }, { unique: true });
qaProjectSchema.index({ workspace: 1, isArchived: 1, name: 1 });

module.exports = mongoose.models.QaProject || mongoose.model("QaProject", qaProjectSchema);
export {};
