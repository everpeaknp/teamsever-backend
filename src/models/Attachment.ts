const mongoose = require("mongoose");

/**
 * Attachment Model
 * Stores metadata for uploaded files
 */

const attachmentSchema = new mongoose.Schema(
  {
    // File information
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true, // Cloudinary secure_url
    },
    publicId: {
      type: String,
      required: true, // Cloudinary public_id for deletion
    },
    version: {
      type: Number, // Cloudinary version number
    },
    fileType: {
      type: String, // 'image', 'raw', 'video', 'auto'
      enum: ["image", "raw", "video", "auto"],
      default: "auto",
    },

    // Upload metadata
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },

    // Resource association (one of these will be set)
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskComment",
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
    },

    // Workspace for access control
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
attachmentSchema.index({ task: 1, isDeleted: 1 });
attachmentSchema.index({ comment: 1, isDeleted: 1 });
attachmentSchema.index({ conversation: 1, isDeleted: 1 });
attachmentSchema.index({ message: 1, isDeleted: 1 });
attachmentSchema.index({ uploadedBy: 1 });
attachmentSchema.index({ workspace: 1 });
attachmentSchema.index({ createdAt: -1 });

// Virtual for attachment type
attachmentSchema.virtual("attachmentType").get(function (this: any) {
  if (this.task) return "task";
  if (this.comment) return "comment";
  if (this.conversation || this.message) return "dm";
  return "unknown";
});

// Method to check if file is an image
attachmentSchema.methods.isImage = function (this: any) {
  return this.mimeType.startsWith("image/");
};

// Method to check if file is a document
attachmentSchema.methods.isDocument = function (this: any) {
  const docTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];
  return docTypes.includes(this.mimeType);
};

// Method to get human-readable file size
attachmentSchema.methods.getReadableSize = function (this: any) {
  const bytes = this.size;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

// Soft delete method
attachmentSchema.methods.softDelete = async function (userId: string) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return await this.save();
};

// Static method to get attachments by resource
attachmentSchema.statics.getByTask = function (taskId: string) {
  return this.find({ task: taskId, isDeleted: false }).populate(
    "uploadedBy",
    "name email"
  );
};

attachmentSchema.statics.getByComment = function (commentId: string) {
  return this.find({ comment: commentId, isDeleted: false }).populate(
    "uploadedBy",
    "name email"
  );
};

attachmentSchema.statics.getByConversation = function (conversationId: string) {
  return this.find({ conversation: conversationId, isDeleted: false }).populate(
    "uploadedBy",
    "name email"
  );
};

attachmentSchema.statics.getByMessage = function (messageId: string) {
  return this.find({ message: messageId, isDeleted: false }).populate(
    "uploadedBy",
    "name email"
  );
};

const Attachment = mongoose.model("Attachment", attachmentSchema);

module.exports = Attachment;

export {};
