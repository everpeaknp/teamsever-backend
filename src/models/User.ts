import mongoose, { Document } from "mongoose";

interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
  coverPhoto?: string;
  googleId?: string;
  githubUsername?: string;
  isSuperUser?: boolean;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  subscription?: {
    planId: mongoose.Types.ObjectId;
    isPaid: boolean;
    paidAt?: Date;
    expiresAt?: Date;
    status: 'free' | 'active' | 'expired';
    billingCycle?: 'monthly' | 'annual'; // New: Billing cycle
    memberCount?: number; // New: Number of seats purchased
    pricePerSeat?: number; // New: Price per seat at time of purchase
    featureOverrides?: {
      maxWorkspaces?: number;
      maxMembers?: number;
      maxAdmins?: number;
      maxSpaces?: number;
      maxLists?: number;
      maxFolders?: number;
      maxTasks?: number;
      maxTablesCount?: number;
      maxRowsLimit?: number;
      maxColumnsLimit?: number;
      maxFiles?: number;
      maxDocuments?: number;
      maxDirectMessagesPerUser?: number;
      canCreatePrivateChannels?: boolean;
      maxPrivateChannelsCount?: number;
      maxMembersPerPrivateChannel?: number;
    };
  };
  notificationPreferences?: {
    githubCommits: boolean;
    taskAssigned: boolean;
    taskStatusChange: boolean;
    taskUpdates: boolean;
    messages: boolean; // For Direct Messages
    groupChats: boolean; // For all Group Chats
    mentions: boolean;
    comments: boolean;
    notices: boolean;
    mutedChannels: string[]; // IDs of channels to mute
    mutedUsers: string[]; // IDs of users to mute in DMs
  };
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    coverPhoto: { type: String },
    googleId: { type: String },
    githubUsername: { type: String },
    isSuperUser: {
      type: Boolean,
      default: false
    },
    notificationPreferences: {
      githubCommits: { type: Boolean, default: true },
      taskAssigned: { type: Boolean, default: true },
      taskStatusChange: { type: Boolean, default: true },
      taskUpdates: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      groupChats: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      notices: { type: Boolean, default: true },
      mutedChannels: [{ type: String }],
      mutedUsers: [{ type: String }],
    },
    passwordResetToken: {
      type: String
    },
    passwordResetTokenExpires: {
      type: Date
    },
    subscription: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan"
      },
      isPaid: {
        type: Boolean,
        default: false
      },
      paidAt: {
        type: Date
      },
      expiresAt: {
        type: Date
      },
      status: {
        type: String,
        enum: ['free', 'active', 'expired'],
        default: 'free'
      },
      billingCycle: {
        type: String,
        enum: ['monthly', 'annual'],
        default: 'monthly'
      },
      memberCount: {
        type: Number,
        min: 1,
        default: 1
      },
      pricePerSeat: {
        type: Number,
        min: 0,
        default: 0
      },
      featureOverrides: {
        maxWorkspaces: { type: Number },
        maxMembers: { type: Number },
        maxAdmins: { type: Number },
        maxSpaces: { type: Number },
        maxLists: { type: Number },
        maxFolders: { type: Number },
        maxTasks: { type: Number },
        maxTablesCount: { type: Number },
        maxRowsLimit: { type: Number },
        maxColumnsLimit: { type: Number },
        maxFiles: { type: Number },
        maxDocuments: { type: Number },
        maxDirectMessagesPerUser: { type: Number },
        canCreatePrivateChannels: { type: Boolean },
        maxPrivateChannelsCount: { type: Number },
        maxMembersPerPrivateChannel: { type: Number }
      }
    }
  },
  { timestamps: true }
);

const UserModel = mongoose.model<IUser>("User", userSchema);

// Export for both CommonJS and ES6
module.exports = UserModel;
export default UserModel;
