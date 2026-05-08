const mongoose = require("mongoose");
const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    participants: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
      validate: {
        validator: function (v: any) {
          return v.length === 2;
        },
        message: "A conversation must have exactly 2 participants",
      },
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient participant queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ workspace: 1, participants: 1 });

// Index for sorting conversations by last message
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);

export {};
