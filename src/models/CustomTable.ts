import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

export interface IColumn {
  id: string;
  title: string;
  type: 'text' | 'link' | 'number';
}

export interface IRow {
  id: string;
  data: Map<string, any>; // columnId -> value
  colors: Map<string, string>; // columnId -> hex color
}

export interface ICustomTable extends Document {
  spaceId: Schema.Types.ObjectId;
  name: string;
  columns: IColumn[];
  rows: IRow[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customTableSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, "Please provide table name"],
      trim: true,
      maxlength: [100, "Table name cannot exceed 100 characters"]
    },
    columns: [
      {
        id: {
          type: String,
          required: true
        },
        title: {
          type: String,
          required: true,
          trim: true,
          maxlength: [100, "Column title cannot exceed 100 characters"]
        },
        type: {
          type: String,
          enum: ['text', 'link', 'number'],
          required: true,
          default: 'text'
        }
      }
    ],
    rows: [
      {
        id: {
          type: String,
          required: true
        },
        data: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
          default: {}
        },
        colors: {
          type: Map,
          of: String, // hex color strings for background
          default: {}
        },
        textColors: {
          type: Map,
          of: String, // hex color strings for text
          default: {}
        }
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        // Convert Maps to plain objects for JSON serialization
        if (ret.rows) {
          ret.rows = ret.rows.map((row: any) => ({
            ...row,
            data: row.data instanceof Map ? Object.fromEntries(row.data) : row.data,
            colors: row.colors instanceof Map ? Object.fromEntries(row.colors) : row.colors,
            textColors: row.textColors instanceof Map ? Object.fromEntries(row.textColors) : row.textColors
          }));
        }
        return ret;
      }
    },
    toObject: {
      transform: function(doc, ret) {
        // Convert Maps to plain objects for toObject() calls
        if (ret.rows) {
          ret.rows = ret.rows.map((row: any) => ({
            ...row,
            data: row.data instanceof Map ? Object.fromEntries(row.data) : row.data,
            colors: row.colors instanceof Map ? Object.fromEntries(row.colors) : row.colors,
            textColors: row.textColors instanceof Map ? Object.fromEntries(row.textColors) : row.textColors
          }));
        }
        return ret;
      }
    }
  }
);

// Compound index for efficient queries
customTableSchema.index({ spaceId: 1, isDeleted: 1 });

module.exports = mongoose.model("CustomTable", customTableSchema);
export {};
