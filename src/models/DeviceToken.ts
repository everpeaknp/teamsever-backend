import { Schema, model, Document, Types } from "mongoose";

export interface IDeviceToken extends Document {
  user: Types.ObjectId;
  token: string;
  platform: "web" | "android" | "ios";
  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ["web", "android", "ios"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
deviceTokenSchema.index({ user: 1, platform: 1 });

const DeviceToken = model<IDeviceToken>("DeviceToken", deviceTokenSchema);

module.exports = DeviceToken;
export {};
