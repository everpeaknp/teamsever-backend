import mongoose, { Document, Schema } from "mongoose";

export interface IStickyNote extends Document {
  workspace: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const stickyNoteSchema = new Schema<IStickyNote>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: "",
    }
  },
  {
    timestamps: true,
  }
);

// Each user has only one sticky note per workspace
stickyNoteSchema.index({ workspace: 1, user: 1 }, { unique: true });

const StickyNote = mongoose.model<IStickyNote>("StickyNote", stickyNoteSchema);

module.exports = StickyNote;
export default StickyNote;
