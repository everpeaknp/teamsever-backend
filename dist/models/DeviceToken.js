"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const deviceTokenSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    platform: {
        type: String,
        enum: ["web", "android", "ios"],
        required: true,
    },
}, {
    timestamps: true,
});
// Compound index for efficient queries
deviceTokenSchema.index({ user: 1, platform: 1 });
const DeviceToken = (0, mongoose_1.model)("DeviceToken", deviceTokenSchema);
module.exports = DeviceToken;
