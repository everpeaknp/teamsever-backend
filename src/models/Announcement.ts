const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    body: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
announcementSchema.index({ workspace: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;

export {};
