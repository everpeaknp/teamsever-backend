const ProductUpdate = require("../models/ProductUpdate").default;
const ProductUpdateReceipt = require("../models/ProductUpdateReceipt").default;
const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../config/cloudinary").default;
const { isCloudinaryConfigured } = require("../config/cloudinary");
const { Readable } = require("node:stream");
const { validateProductUpdateImage } = require("../utils/productUpdateImagePolicy");
const { hasProductUpdateContentChanged } = require("../utils/productUpdateRevision");
const { validateProductUpdateDraft } = require("../utils/productUpdateValidation");

const requireSuperAdmin = (req: any, res: any) => {
  if (req.user?.isSuperUser) return true;
  res.status(403).json({ success: false, message: "Superadmin access required." });
  return false;
};

exports.adminList = asyncHandler(async (req: any, res: any) => {
  if (!requireSuperAdmin(req, res)) return;
  const data = await ProductUpdate.find().sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data });
});

exports.adminSave = asyncHandler(async (req: any, res: any) => {
  if (!requireSuperAdmin(req, res)) return;
  const { id, title, slides, status } = req.body;
  const validationError = validateProductUpdateDraft(title, slides, status);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  const update = id ? await ProductUpdate.findById(id) : new ProductUpdate({ createdBy: req.user._id });
  if (!update) return res.status(404).json({ success: false, message: "Update not found." });
  const contentChanged = hasProductUpdateContentChanged(update, { title, slides });
  const wasPublished = update.status === "published";
  const hasBeenPublishedBefore = !!update.publishedAt;
  const isRepublishingRevision = hasBeenPublishedBefore && contentChanged;
  update.title = title.trim();
  update.slides = slides;
  update.status = status === "published" ? "published" : "draft";
  if (update.status === "published" && (!wasPublished || !update.publishedAt || contentChanged)) update.publishedAt = new Date();
  if (isRepublishingRevision) update.revision = (update.revision || 1) + 1;
  await update.save();
  res.json({ success: true, data: update });
});

exports.adminDelete = asyncHandler(async (req: any, res: any) => {
  if (!requireSuperAdmin(req, res)) return;
  await ProductUpdate.findByIdAndDelete(req.params.id);
  await ProductUpdateReceipt.deleteMany({ update: req.params.id });
  res.json({ success: true });
});

exports.uploadSlideImage = asyncHandler(async (req: any, res: any) => {
  if (!requireSuperAdmin(req, res)) return;
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ success: false, message: "Image uploads are temporarily unavailable." });
  }
  if (!req.file) return res.status(400).json({ success: false, message: "Choose a PNG, JPEG, or WebP image under 5 MB." });
  const validationError = validateProductUpdateImage(req.file.mimetype, req.file.size);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "product-updates", resource_type: "image" },
      (error: any, uploaded: any) => error ? reject(error) : resolve(uploaded),
    );
    Readable.from([req.file.buffer]).pipe(stream);
  }) as any;
  res.status(201).json({ success: true, data: { imageUrl: result.secure_url } });
});

exports.getNextForUser = asyncHandler(async (req: any, res: any) => {
  const [updates, receipts] = await Promise.all([
    ProductUpdate.find({ status: "published" }).sort({ publishedAt: -1 }).lean(),
    ProductUpdateReceipt.find({ user: req.user._id }).select("update revision").lean(),
  ]);
  const seenRevisions = new Map(receipts.map((receipt: any) => [String(receipt.update), receipt.revision || 1]));
  const data = updates.find((update: any) => (seenRevisions.get(String(update._id)) || 0) < (update.revision || 1)) || null;
  res.json({ success: true, data: data || null });
});

exports.markSeen = asyncHandler(async (req: any, res: any) => {
  const update = await ProductUpdate.findOne({ _id: req.params.id, status: "published" }).select("_id");
  if (!update) return res.status(404).json({ success: false, message: "Published update not found." });
  const requestedRevision = Number(req.body?.revision);
  if (!Number.isInteger(requestedRevision) || requestedRevision < 1) {
    return res.status(400).json({ success: false, message: "A valid update revision is required." });
  }
  await ProductUpdateReceipt.updateOne(
    { user: req.user._id, update: update._id },
    { $max: { revision: requestedRevision }, $set: { seenAt: new Date() }, $setOnInsert: { user: req.user._id, update: update._id } },
    { upsert: true, setDefaultsOnInsert: false },
  );
  res.json({ success: true });
});

export {};
