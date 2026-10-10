const mongoose = require("mongoose");

const qaModuleSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  space: { type: mongoose.Schema.Types.ObjectId, ref: "Space" },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

qaModuleSchema.index({ workspace: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
qaModuleSchema.index({ workspace: 1, isArchived: 1, name: 1 });

module.exports = mongoose.models.QaModule || mongoose.model("QaModule", qaModuleSchema);
export {};
