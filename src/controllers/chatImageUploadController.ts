const Conversation = require("../models/Conversation");
const Workspace = require("../models/Workspace");
const chatService = require("../services/chatService");
const cloudinary = require("../config/cloudinary").default;
const AppError = require("../utils/AppError");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function validateChatImageBatch(files: any[]) {
  if (!files.length || files.length > 5) {
    throw new AppError("Choose between 1 and 5 images per message", 400);
  }
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new AppError("Only JPEG, PNG, WebP, and GIF images are supported", 400);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError("Each image must be 10 MB or smaller", 400);
    }
  }
}

function uploadImage(file: any, workspaceId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `chat-images/${workspaceId}`,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      },
      (error: any, result: any) => {
        if (error || !result?.secure_url) return reject(error || new Error("Image upload failed"));
        resolve(result.secure_url);
      },
    );
    stream.end(file.buffer);
  });
}

const uploadChatImages = async (req: any, res: any) => {
  const files = req.files || [];
  validateChatImageBatch(files);

  const workspaceId = String(req.body.workspaceId || "").trim();
  const userId = String(req.user.id);
  if (!workspaceId) throw new AppError("Workspace ID is required", 400);

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    isDeleted: false,
    $or: [{ owner: userId }, { "members.user": userId }],
  }).select("_id").lean();
  if (!workspace) throw new AppError("You do not have access to this workspace", 403);

  if (req.body.channelId) {
    const channel = await chatService.validateChannelAccess(String(req.body.channelId), userId);
    if (channel.workspace.toString() !== workspaceId) {
      throw new AppError("Channel does not belong to this workspace", 400);
    }
  } else if (req.body.conversationId) {
    const conversation = await Conversation.findOne({
      _id: req.body.conversationId,
      workspace: workspaceId,
      participants: userId,
    }).select("_id").lean();
    if (!conversation) throw new AppError("You do not have access to this conversation", 403);
  } else {
    throw new AppError("A channel or conversation is required", 400);
  }

  const attachments: string[] = [];
  for (const file of files) attachments.push(await uploadImage(file, workspaceId));
  res.status(201).json({ success: true, data: { attachments } });
};

module.exports = { uploadChatImages, validateChatImageBatch, MAX_IMAGE_BYTES };

export {};
