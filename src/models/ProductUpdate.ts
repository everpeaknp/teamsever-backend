import { Schema, model, Document, Types } from "mongoose";

export interface IProductUpdate extends Document {
  title: string;
  slides: { title: string; body: string; imageUrl?: string; ctaLabel?: string }[];
  status: "draft" | "published";
  revision: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
}

const productUpdateSchema = new Schema<IProductUpdate>({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  slides: [{
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    imageUrl: { type: String, trim: true },
    ctaLabel: { type: String, trim: true, maxlength: 40 },
  }],
  status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
  revision: { type: Number, default: 1 },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default model<IProductUpdate>("ProductUpdate", productUpdateSchema);
