import mongoose, { Document } from "mongoose";

interface IFeedback extends Document {
  title: string;
  description: string;
  category: 'Bug Report' | 'Feature Request' | 'Support Question' | 'General Feedback' | 'Performance Issue';
  workspace: mongoose.Types.ObjectId;
  workspaceName: string;
  submittedBy: mongoose.Types.ObjectId;
  submittedByName: string;
  status: 'pending' | 'resolved';
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      required: true,
      enum: ['Bug Report', 'Feature Request', 'Support Question', 'General Feedback', 'Performance Issue']
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    workspaceName: {
      type: String,
      required: true
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedByName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending'
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ workspace: 1 });

const FeedbackModel = mongoose.model<IFeedback>("Feedback", feedbackSchema);

// Export for both CommonJS and ES6
module.exports = FeedbackModel;
export default FeedbackModel;
