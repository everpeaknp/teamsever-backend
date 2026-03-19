import { Schema, model, Document, Types } from "mongoose";

export interface IChatMessage extends Document {
  workspace: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: "text" | "system";
  mentions: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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

// Compound indexes for efficient queries
chatMessageSchema.index({ workspace: 1, createdAt: -1 });
chatMessageSchema.index({ workspace: 1, isDeleted: 1, createdAt: -1 });

const ChatMessage = model<IChatMessage>("ChatMessage", chatMessageSchema);

module.exports = ChatMessage;
export {};
