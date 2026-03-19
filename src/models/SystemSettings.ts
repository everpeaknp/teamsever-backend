import mongoose, { Document } from "mongoose";

interface ISystemSettings extends Document {
  whatsappContactNumber: string;
  systemName: string;
  accentColor: string;
  themeMode: 'light' | 'dark' | 'auto';
  logoUrl: string;
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
    systemName: {
      type: String,
      required: true,
      trim: true,
      default: "Teamsever"
    },
    accentColor: {
      type: String,
      required: true,
      trim: true,
      default: "mint"
    },
    themeMode: {
      type: String,
      required: true,
      enum: ['light', 'dark', 'auto'],
      default: "light"
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "/teamsever_logo.png"
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
