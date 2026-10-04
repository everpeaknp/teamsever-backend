import { Schema, model, Document, Types } from "mongoose";

export interface ILeaveRequest extends Document {
  workspace: Types.ObjectId;
  requester: Types.ObjectId;
  assignedManager: Types.ObjectId; // User B who received the request
  conversation?: Types.ObjectId; // DM conversation ID if created via DM
  directMessageId?: Types.ObjectId; // The DM message ID containing the interactive card
  startDate: Date;
  endDate: Date;
  daysCount: number; // calculated number of days
  reason: string; // Compulsory reason
  status: "pending" | "approved" | "denied" | "expired";
  expiredAt?: Date;
  requestType?: "leave" | "remote";
  remoteAreaId?: Types.ObjectId;
  remoteAreaName?: string;
  proposedRemoteArea?: { name: string; latitude: number; longitude: number; radiusMeters: number };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  deniedBy?: Types.ObjectId;
  deniedAt?: Date;
  denialReason?: string; // Optional denial reason
  isExceedingMonthlyQuota: boolean; // Flag if requester already had >= 2 days of approved leave in that calendar month
  monthlyLeaveCountAtRequest: number; // Snapshot of approved days already taken this month at request time
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "Workspace is required"],
      index: true,
    },
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Requester user is required"],
      index: true,
    },
    assignedManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned manager is required"],
      index: true,
    },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    directMessageId: {
      type: Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    daysCount: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: [true, "Leave reason is compulsory"],
      trim: true,
      minlength: [3, "Reason must be at least 3 characters"],
      maxlength: [1000, "Reason cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "expired"],
      default: "pending",
      index: true,
    },
    requestType: { type: String, enum: ["leave", "remote"], default: "leave", index: true },
    remoteAreaId: { type: Schema.Types.ObjectId, default: null },
    remoteAreaName: { type: String, trim: true, maxlength: 80 },
    proposedRemoteArea: {
      name: { type: String, trim: true, maxlength: 80 },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      radiusMeters: { type: Number, min: 25, max: 50000 }
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    deniedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deniedAt: {
      type: Date,
      default: null,
    },
    expiredAt: { type: Date, default: null },
    denialReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, "Denial reason cannot exceed 1000 characters"],
    },
    isExceedingMonthlyQuota: {
      type: Boolean,
      default: false,
    },
    monthlyLeaveCountAtRequest: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
leaveRequestSchema.index({ workspace: 1, status: 1, startDate: 1 });
leaveRequestSchema.index({ workspace: 1, requester: 1, createdAt: -1 });

const LeaveRequest = model<ILeaveRequest>("LeaveRequest", leaveRequestSchema);

module.exports = LeaveRequest;
export {};
