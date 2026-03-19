"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const systemSettingsSchema = new mongoose_1.default.Schema({
    whatsappContactNumber: {
        type: String,
        required: true,
        trim: true,
        default: "+1234567890"
    },
    updatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});
// Ensure only one settings document exists
systemSettingsSchema.index({ _id: 1 }, { unique: true });
const SystemSettingsModel = mongoose_1.default.model("SystemSettings", systemSettingsSchema);
// Export for both CommonJS and ES6
module.exports = SystemSettingsModel;
exports.default = SystemSettingsModel;
