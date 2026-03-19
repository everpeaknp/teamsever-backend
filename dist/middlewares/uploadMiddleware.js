"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const multer = require("multer");
const path = require("path");
const { uploadConfig, isCloudinaryConfigured } = require("../config/cloudinary");
/**
 * File Upload Middleware using Multer (Memory Storage)
 * Files are stored in memory temporarily before uploading to Cloudinary
 *
 * Note: For direct Cloudinary uploads from frontend, use the signature-based approach
 * This middleware is for server-side uploads if needed
 */
// File filter function
const fileFilter = (req, file, cb) => {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured()) {
        return cb(new Error("File upload is not configured. Please configure Cloudinary."));
    }
    // Check file type
    if (!uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error(`File type not allowed. Allowed types: ${uploadConfig.allowedMimeTypes.join(", ")}`));
    }
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!uploadConfig.allowedExtensions.includes(ext)) {
        return cb(new Error(`File extension not allowed. Allowed extensions: ${uploadConfig.allowedExtensions.join(", ")}`));
    }
    cb(null, true);
};
// Memory storage configuration (files stored in memory as Buffer)
const storage = multer.memoryStorage();
// Multer upload configuration
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: uploadConfig.maxFileSize,
        files: 5, // Max 5 files per request
    },
});
// Single file upload
const uploadSingle = upload.single("file");
// Multiple files upload
const uploadMultiple = upload.array("files", 5);
// Error handler middleware
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: `File size exceeds maximum limit of ${uploadConfig.maxFileSize / 1024 / 1024}MB`,
            });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                message: "Too many files. Maximum 5 files allowed per request.",
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                message: "Unexpected field name. Use 'file' or 'files' as field name.",
            });
        }
        return res.status(400).json({
            message: `Upload error: ${err.message}`,
        });
    }
    if (err) {
        return res.status(400).json({
            message: err.message || "File upload failed",
        });
    }
    next();
};
module.exports = {
    upload,
    uploadSingle,
    uploadMultiple,
    handleUploadError
};
