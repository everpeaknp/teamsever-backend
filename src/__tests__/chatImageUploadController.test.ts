import { validateChatImageBatch, MAX_IMAGE_BYTES } from "../controllers/chatImageUploadController";
import { sendMessageSchema as directMessageSchema } from "../validators/directMessageValidators";
import { sendMessageSchema as groupMessageSchema } from "../validators/chatValidators";

const image = (overrides: Record<string, unknown> = {}) => ({
  mimetype: "image/jpeg",
  size: 1024,
  ...overrides,
});

describe("chat image upload and message validation", () => {
  it("accepts up to five supported images under 10 MB", () => {
    expect(() => validateChatImageBatch(Array.from({ length: 5 }, () => image()))).not.toThrow();
  });

  it("rejects empty, oversized, and non-image upload batches", () => {
    expect(() => validateChatImageBatch([])).toThrow("Choose between 1 and 5 images");
    expect(() => validateChatImageBatch([image({ size: MAX_IMAGE_BYTES + 1 })])).toThrow("10 MB or smaller");
    expect(() => validateChatImageBatch([image({ mimetype: "application/pdf" })])).toThrow("Only JPEG");
    expect(() => validateChatImageBatch(Array.from({ length: 6 }, () => image()))).toThrow("between 1 and 5");
  });

  it("allows image-only messages in DM and group chat", () => {
    const url = "https://res.cloudinary.com/teamsever/image/upload/chat-images/workspace-1/sample.jpg";
    expect(directMessageSchema.safeParse({ body: { workspaceId: "workspace-1", content: "", attachments: [url] } }).success).toBe(true);
    expect(groupMessageSchema.safeParse({ body: { content: "", attachments: [url] }, params: { workspaceId: "workspace-1" } }).success).toBe(true);
  });

  it("rejects empty messages, more than five images, and untrusted URLs", () => {
    const urls = Array.from({ length: 6 }, (_, index) => `https://res.cloudinary.com/teamsever/image/upload/${index}.jpg`);
    expect(directMessageSchema.safeParse({ body: { workspaceId: "workspace-1", content: "" } }).success).toBe(false);
    expect(groupMessageSchema.safeParse({ body: { content: "", attachments: urls }, params: { workspaceId: "workspace-1" } }).success).toBe(false);
    expect(directMessageSchema.safeParse({ body: { workspaceId: "workspace-1", content: "", attachments: ["https://example.com/a.jpg"] } }).success).toBe(false);
  });
});
