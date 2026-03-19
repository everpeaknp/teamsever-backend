import { Schema, model, Document, Types } from "mongoose";

export interface ITaskComment extends Document {
  task: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  mentions: Types.ObjectId[];
  edited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskCommentSchema = new Schema<ITaskComment>(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    mentions: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
taskCommentSchema.index({ task: 1, createdAt: 1 });

const TaskComment = model<ITaskComment>("TaskComment", taskCommentSchema);

module.exports = TaskComment;
export {};
