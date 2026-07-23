import { Schema, model, Document, Types } from "mongoose";

export interface IAccessRequest extends Document {
  workspace: Types.ObjectId;
  requester: Types.ObjectId;
  requestedRole: string;
  message?: string;
  status: "pending" | "approved" | "denied";
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedRole: {
      type: String,
      enum: ["admin", "operations_manager", "project_manager", "qa", "developer", "member"],
      default: "member",
      required: true,
    },
    message: {
      type: String,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
      index: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One pending request per user per workspace at a time
accessRequestSchema.index(
  { workspace: 1, requester: 1, status: 1 },
  { unique: false }
);

const AccessRequest = model<IAccessRequest>("AccessRequest", accessRequestSchema);

module.exports = AccessRequest;
export default AccessRequest;
