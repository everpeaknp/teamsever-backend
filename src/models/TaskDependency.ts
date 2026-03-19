const mongoose = require("mongoose");

/**
 * Dependency Types:
 * - FS (Finish-to-Start): Task cannot start until dependsOn is finished
 * - SS (Start-to-Start): Task cannot start until dependsOn has started
 * - FF (Finish-to-Finish): Task cannot finish until dependsOn is finished
 * - SF (Start-to-Finish): Task cannot finish until dependsOn has started
 */
const taskDependencySchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Please provide task"]
    },
    dependsOn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Please provide dependency task"]
    },
    type: {
      type: String,
      enum: ["FS", "SS", "FF", "SF"],
      default: "FS",
      required: true
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
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
taskDependencySchema.index({ task: 1, isDeleted: 1 });
taskDependencySchema.index({ dependsOn: 1, isDeleted: 1 });
taskDependencySchema.index({ workspace: 1, isDeleted: 1 });
taskDependencySchema.index({ project: 1, isDeleted: 1 });
taskDependencySchema.index({ task: 1, dependsOn: 1 }, { unique: true });

module.exports = mongoose.model("TaskDependency", taskDependencySchema);

export {};
