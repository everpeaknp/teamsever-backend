import { Schema, model, Document, Types } from "mongoose";

export interface IChatChannel extends Document {
  workspace: Types.ObjectId;
  name: string;
  description?: string;
  type: "public" | "private";
  members: Types.ObjectId[];
  createdBy: Types.ObjectId;
  isDefault: boolean;
  lastMessageAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatChannelSchema = new Schema<IChatChannel>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatChannelSchema.index({ workspace: 1, name: 1 }, { unique: true });
chatChannelSchema.index({ workspace: 1, isDeleted: 1 });

const ChatChannel = model<IChatChannel>("ChatChannel", chatChannelSchema);

module.exports = ChatChannel;
export {};
