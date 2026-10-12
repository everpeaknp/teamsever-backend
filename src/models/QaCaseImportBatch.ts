const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "QaProject" },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  rows: { type: [mongoose.Schema.Types.Mixed], required: true },
  status: { type: String, enum: ["preview", "committing", "complete"], default: "preview" },
  outcome: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.models.QaCaseImportBatch || mongoose.model("QaCaseImportBatch", schema);
export {};
