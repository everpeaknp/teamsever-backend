import mongoose, { Document } from "mongoose";

interface ISystemSettings extends Document {
  whatsappContactNumber: string;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingsSchema = new mongoose.Schema(
  {
    whatsappContactNumber: {
      type: String,
      required: true,
      trim: true,
      default: "+1234567890"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { 
    timestamps: true 
  }
);

// Ensure only one settings document exists
systemSettingsSchema.index({ _id: 1 }, { unique: true });

const SystemSettingsModel = mongoose.model<ISystemSettings>("SystemSettings", systemSettingsSchema);

// Export for both CommonJS and ES6
module.exports = SystemSettingsModel;
export default SystemSettingsModel;
