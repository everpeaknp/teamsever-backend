import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface ICustomFieldValue extends Document {
  task: Schema.Types.ObjectId;
  customField: Schema.Types.ObjectId;
  value: any; // Can be string, number, boolean, or Date depending on field type
  createdAt: Date;
  updatedAt: Date;
}

const customFieldValueSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true
    },
    customField: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomField",
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
customFieldValueSchema.index({ task: 1, customField: 1 }, { unique: true });
customFieldValueSchema.index({ customField: 1 });

module.exports = mongoose.model("CustomFieldValue", customFieldValueSchema);
export {};
