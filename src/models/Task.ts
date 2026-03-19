import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface ITask extends Document {
  title: string;
  description?: string;
  status: "todo" | "inprogress" | "review" | "done" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  startDate?: Date;
  dueDate?: Date;
  deadline?: Date; // Task deadline for performance tracking
  isMilestone: boolean;
  list: Schema.Types.ObjectId;
  space: Schema.Types.ObjectId; // Denormalized for performance
  workspace: Schema.Types.ObjectId; // Denormalized for performance
  assignee?: Schema.Types.ObjectId;
  assigneeId?: Schema.Types.ObjectId; // Alias for assignee
  createdBy: Schema.Types.ObjectId;
  // Subtasks and Dependencies
  parentTask?: Schema.Types.ObjectId; // Reference to parent task if this is a subtask
  subTasks: Schema.Types.ObjectId[]; // Array of subtask IDs
  dependencies: Schema.Types.ObjectId[]; // Tasks that this task depends on (blockers)
  dependents: Schema.Types.ObjectId[]; // Tasks that depend on this task (blocked tasks)
  // Custom Fields
  customFieldValues: Array<{
    field: Schema.Types.ObjectId;
    value: any;
  }>;
  // Time Tracking
  timeLogs: Array<{
    user: Schema.Types.ObjectId;
    startTime: Date;
    endTime?: Date;
    duration?: number; // Duration in milliseconds
    description?: string;
    isManual: boolean; // True if manually entered
  }>;
  activeTimer?: {
    user: Schema.Types.ObjectId;
    startTime: Date;
  };
  totalTimeSpent?: number; // Total time in milliseconds (calculated)
  // Recurrence
  isRecurring: boolean;
  frequency?: "daily" | "weekly" | "monthly" | "custom";
  interval?: number; // e.g., every 2 weeks
  nextOccurrence?: Date;
  recurrenceEnd?: Date;
  recurringTaskId?: Schema.Types.ObjectId; // Reference to original recurring task
  completedAt?: Date; // Timestamp when task was marked as done
  completedBy?: Schema.Types.ObjectId; // User who completed the task
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide task title"],
      trim: true,
      maxlength: [200, "Task title cannot exceed 200 characters"]
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"]
    },
    status: {
      type: String,
      enum: ["todo", "inprogress", "review", "done", "cancelled"],
      default: "todo"
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    startDate: {
      type: Date
    },
    dueDate: {
      type: Date
    },
    deadline: {
      type: Date
    },
    isMilestone: {
      type: Boolean,
      default: false
    },
    list: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "List",
      required: true
    },
    space: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // Subtasks and Dependencies
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null
    },
    subTasks: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    }],
    dependencies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    }],
    dependents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    }],
    // Custom Fields
    customFieldValues: [{
      field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomField"
      },
      value: mongoose.Schema.Types.Mixed
    }],
    // Time Tracking
    timeLogs: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      startTime: {
        type: Date,
        required: true
      },
      endTime: {
        type: Date
      },
      duration: {
        type: Number // Duration in milliseconds
      },
      description: {
        type: String,
        maxlength: [500, "Time log description cannot exceed 500 characters"]
      },
      isManual: {
        type: Boolean,
        default: false
      }
    }],
    activeTimer: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      startTime: {
        type: Date
      }
    },
    totalTimeSpent: {
      type: Number,
      default: 0 // Total time in milliseconds
    },
    // Recurrence
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "custom"],
      required: function(this: ITask) {
        return this.isRecurring;
      }
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    nextOccurrence: {
      type: Date
    },
    recurrenceEnd: {
      type: Date
    },
    recurringTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    },
    completedAt: {
      type: Date
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
taskSchema.index({ list: 1, isDeleted: 1 });
taskSchema.index({ space: 1, isDeleted: 1 });
taskSchema.index({ workspace: 1, isDeleted: 1 });
taskSchema.index({ status: 1, isDeleted: 1 });
taskSchema.index({ assignee: 1, isDeleted: 1 });
taskSchema.index({ dueDate: 1, isDeleted: 1 });
taskSchema.index({ priority: 1, isDeleted: 1 });
taskSchema.index({ parentTask: 1, isDeleted: 1 });
taskSchema.index({ dependencies: 1 });
taskSchema.index({ dependents: 1 });
taskSchema.index({ isRecurring: 1, nextOccurrence: 1 });
taskSchema.index({ recurringTaskId: 1 });

// Analytics-specific indexes
taskSchema.index({ workspace: 1, status: 1, updatedAt: 1 }); // For velocity queries
taskSchema.index({ workspace: 1, status: 1, completedAt: 1 }); // For completion tracking
taskSchema.index({ workspace: 1, assignee: 1, status: 1 }); // For team workload
taskSchema.index({ workspace: 1, completedBy: 1, status: 1 }); // For performance tracking
taskSchema.index({ completedBy: 1, completedAt: 1, deadline: 1 }); // For deadline success rate
taskSchema.index({ updatedAt: 1 }); // For time-based queries
taskSchema.index({ completedAt: 1 }); // For completion time analysis
taskSchema.index({ createdAt: 1, updatedAt: 1 }); // For lead time calculation

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);
export {};
