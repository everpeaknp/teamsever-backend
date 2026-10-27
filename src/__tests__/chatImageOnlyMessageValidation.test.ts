const ChatMessage = require("../models/ChatMessage");
const DirectMessage = require("../models/DirectMessage");

describe("image-only chat message validation", () => {
  it.each([
    ["group chat", ChatMessage, { workspace: "507f1f77bcf86cd799439011", channel: "507f1f77bcf86cd799439012" }],
    ["direct message", DirectMessage, { conversation: "507f1f77bcf86cd799439013" }],
  ])("allows an attachment without text for %s", (_kind, MessageModel, context) => {
    const message = new MessageModel({
      ...context,
      sender: "507f1f77bcf86cd799439014",
      content: "",
      attachments: ["https://res.cloudinary.com/example/image/upload/chat-images/photo.jpg"],
    });

    expect(message.validateSync()?.errors?.content).toBeUndefined();
  });

  it.each([
    ["group chat", ChatMessage, { workspace: "507f1f77bcf86cd799439011", channel: "507f1f77bcf86cd799439012" }],
    ["direct message", DirectMessage, { conversation: "507f1f77bcf86cd799439013" }],
  ])("still requires content when there are no attachments for %s", (_kind, MessageModel, context) => {
    const message = new MessageModel({
      ...context,
      sender: "507f1f77bcf86cd799439014",
      content: "",
      attachments: [],
    });

    expect(message.validateSync()?.errors?.content).toBeDefined();
  });
});
