export const PRODUCT_UPDATE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PRODUCT_UPDATE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProductUpdateImage(mimeType: string, size: number): string | null {
  if (!PRODUCT_UPDATE_IMAGE_TYPES.has(mimeType)) return "Use a PNG, JPEG, or WebP image.";
  if (!Number.isFinite(size) || size <= 0 || size > PRODUCT_UPDATE_IMAGE_MAX_BYTES) {
    return "Image must be greater than 0 bytes and no larger than 5 MB.";
  }
  return null;
}
