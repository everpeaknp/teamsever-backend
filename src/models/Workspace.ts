import { Document, Schema } from "mongoose";

const mongoose = require("mongoose");

// Workspace roles - matches permission system
export enum WorkspaceRole {
  OWNER = "owner",
  ADMIN = "admin",
  OPERATIONS_MANAGER = "operations_manager",
  PROJECT_MANAGER = "project_manager",
  QA = "qa",
  DEVELOPER = "developer",
  MEMBER = "member",
  GUEST = "guest"
}

export interface IWorkspaceMember {
  user: Schema.Types.ObjectId;
  role: WorkspaceRole | "owner" | "admin" | "operations_manager" | "project_manager" | "qa" | "developer" | "member" | "guest";
  customRole?: Schema.Types.ObjectId; 
  status?: "active" | "inactive";
  customRoleTitle?: string; 
  lastChatReadAt?: Date;
  canMarkTaskDone?: boolean;
  additionalPermissions?: string[];
  restrictedPermissions?: string[];
  attendanceMode?: "onsite" | "remote";
  assignedRemoteLocationIds?: Schema.Types.ObjectId[];
  privateRemoteAreas?: Array<{ _id?: Schema.Types.ObjectId; name: string; latitude: number; longitude: number; radiusMeters: number; isActive: boolean; networkIp?: string }>;
  temporaryRemoteApprovals?: Array<{ areaId: Schema.Types.ObjectId; startDate: Date; endDate: Date; requestId: Schema.Types.ObjectId }>;
}

export interface IRolePermissionAddition {
  role: WorkspaceRole | "owner" | "admin" | "operations_manager" | "project_manager" | "qa" | "developer" | "member" | "guest";
  permissions: string[];
}

export interface IWorkspace extends Document {
  name: string;
  timezone: string;
  logo?: string;
  owner: Schema.Types.ObjectId;
  members: IWorkspaceMember[];
  rolePermissionAdditions?: IRolePermissionAddition[];
  lastAnnouncementTime?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  attendanceLocationPolicy?: {
    enabled: boolean;
    maxAccuracyMeters: number;
    checkIntervalSeconds: number;
    staleAfterSeconds: number;
    areas: Array<{ _id: Schema.Types.ObjectId; name: string; kind: "office" | "remote"; latitude: number; longitude: number; radiusMeters: number; isActive: boolean; networkIp?: string }>;
  };
  desktopPresencePolicy?: { afkThresholdMinutes: number };
}

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide workspace name"],
      trim: true,
      maxlength: [100, "Workspace name cannot exceed 100 characters"]
    },
    timezone: {
      type: String,
      trim: true,
      default: "UTC",
      maxlength: [100, "Workspace timezone is invalid"]
    },
    logo: {
      type: String,
      default: null
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        role: {
          type: String,
          enum: ["owner", "admin", "operations_manager", "project_manager", "qa", "developer", "member", "guest"],
          default: "member"
        },
        customRole: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CustomRole",
          default: null
        },
        status: {
          type: String,
          enum: ["active", "inactive"],
          default: "active"  // Changed from "inactive" to "active"
        },
        customRoleTitle: {
          type: String,
          trim: true,
          maxlength: [50, "Custom role title cannot exceed 50 characters"],
          default: null
        },
        lastChatReadAt: {
          type: Date,
          default: null
        },
        canMarkTaskDone: {
          type: Boolean,
          default: false
        },
        additionalPermissions: [
          {
            type: String
          }
        ],
        restrictedPermissions: [
          {
            type: String
          }
        ],
        attendanceMode: { type: String, enum: ["onsite", "remote"], default: "onsite" },
        assignedRemoteLocationIds: [{ type: mongoose.Schema.Types.ObjectId }],
        privateRemoteAreas: { type: [{
          name: { type: String, required: true, trim: true, maxlength: 80 },
          latitude: { type: Number, required: true, min: -90, max: 90 },
          longitude: { type: Number, required: true, min: -180, max: 180 },
          radiusMeters: { type: Number, required: true, min: 25, max: 50000 },
          isActive: { type: Boolean, default: true },
          networkIp: { type: String, trim: true, maxlength: 45, default: undefined }
        }], select: false },
        temporaryRemoteApprovals: { type: [{ areaId: mongoose.Schema.Types.ObjectId, startDate: Date, endDate: Date, requestId: mongoose.Schema.Types.ObjectId }], select: false }
      }
    ],
    rolePermissionAdditions: [
      {
        role: {
          type: String,
          enum: ["owner", "admin", "operations_manager", "project_manager", "qa", "developer", "member", "guest"],
          required: true
        },
        permissions: [
          {
            type: String,
            required: true
          }
        ]
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    lastAnnouncementTime: {
      type: Date,
      default: null
    },
    desktopPresencePolicy: {
      afkThresholdMinutes: { type: Number, default: 5, min: 1, max: 60 }
    },
    attendanceLocationPolicy: {
      enabled: { type: Boolean, default: false },
      maxAccuracyMeters: { type: Number, default: 100 },
      checkIntervalSeconds: { type: Number, default: 60 },
      staleAfterSeconds: { type: Number, default: 120 },
      areas: [{
        name: { type: String, required: true, trim: true, maxlength: 80 },
        kind: { type: String, enum: ["office", "remote"], required: true },
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 },
        radiusMeters: { type: Number, required: true, min: 25, max: 50000 },
        isActive: { type: Boolean, default: true },
        networkIp: { type: String, trim: true, maxlength: 45, default: undefined }
      }]
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
workspaceSchema.index({ owner: 1, isDeleted: 1 });
workspaceSchema.index({ "members.user": 1, isDeleted: 1 });

module.exports = mongoose.model("Workspace", workspaceSchema);
export {};
