import { v2 as cloudinary } from "cloudinary";

const Attachment = require("../models/Attachment");
const runs = require("./testRunService");
const AppError = require("../utils/AppError");
const { uploadConfig, getResourceType, isCloudinaryConfigured } = require("../config/cloudinary");

export const listEvidence = async (workspaceId: string, executionId: string, actorId: string) => {
  const execution = await runs.getExecution(workspaceId, executionId, actorId);
  const ids = [...new Set([
    ...(execution.evidenceIds || []),
    ...(execution.stepResults || []).flatMap((step: any) => step.evidenceIds || []),
  ].map((id: any) => id.toString()))];
  if (!ids.length) return [];
  return Attachment.find({ _id: { $in: ids }, workspace: workspaceId, execution: executionId, isDeleted: false }).lean();
};

export const uploadEvidence = async (workspaceId: string, executionId: string, actorId: string, file: Express.Multer.File) => {
  if (!file) throw new AppError("Choose a file", 400);
  if (!uploadConfig.allowedMimeTypes.includes(file.mimetype) || file.size > uploadConfig.maxFileSize) {
    throw new AppError("Evidence file type or size is not allowed", 400);
  }
  const execution = await runs.getExecution(workspaceId, executionId, actorId);
  if (execution.run?.status !== "open") throw new AppError("This run is closed", 409);
  if (!isCloudinaryConfigured()) throw new AppError("File upload is not configured", 503);
  const uploaded: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `qa-evidence/${workspaceId}`, resource_type: getResourceType(file.mimetype) }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(file.buffer);
  });
  return Attachment.create({
    filename: uploaded.public_id.split("/").pop(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: uploaded.bytes,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    version: uploaded.version,
    fileType: uploaded.resource_type,
    uploadedBy: actorId,
    execution: executionId,
    workspace: workspaceId,
  });
};
