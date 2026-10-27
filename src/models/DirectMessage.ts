const mongoose = require("mongoose");
const { Schema } = mongoose;

const directMessageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    attachments: { type: [String], default: [], validate: (values: string[]) => values.length <= 5 },
    type: {
      type: String,
      enum: ["text", "leave_request"],
      default: "text",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: Schema.Types.ObjectId, ref: "User" }],
        count: { type: Number, default: 0 },
      },
    ],
    readBy: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient message queries (chat-style ASC)
directMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("DirectMessage", directMessageSchema);

export {};
