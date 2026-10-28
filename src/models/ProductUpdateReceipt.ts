import { Schema, model, Types } from "mongoose";

const productUpdateReceiptSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  update: { type: Schema.Types.ObjectId, ref: "ProductUpdate", required: true },
  revision: { type: Number, default: 1 },
  seenAt: { type: Date, default: Date.now },
}, { timestamps: true });
productUpdateReceiptSchema.index({ user: 1, update: 1 }, { unique: true });

export default model("ProductUpdateReceipt", productUpdateReceiptSchema);
