import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary Configuration
 * Used for file uploads and management
 */

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Check if Cloudinary is configured
export const isCloudinaryConfigured = (): boolean => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// File upload configuration
export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB default
  allowedMimeTypes: (
    process.env.ALLOWED_FILE_TYPES ||
    "image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip"
  ).split(","),
  allowedExtensions: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".zip",
  ],
};

// Get Cloudinary resource type from MIME type
export const getResourceType = (mimeType: string): "image" | "video" | "raw" | "auto" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "raw"; // For documents, PDFs, etc.
};

// Get folder path based on file type
export const getFolderPath = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "attachments/images";
  if (mimeType === "application/pdf") return "attachments/documents";
  if (
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("powerpoint")
  ) {
    return "attachments/documents";
  }
  return "attachments/others";
};

// Log configuration status
if (isCloudinaryConfigured()) {
  console.log(`[Cloudinary] Configured successfully`);
  console.log(`[Cloudinary] Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`[Cloudinary] Max file size: ${uploadConfig.maxFileSize} bytes`);
} else {
  console.warn("[Cloudinary] Not configured. File uploads will be disabled.");
}

export default cloudinary;
export { cloudinary };
