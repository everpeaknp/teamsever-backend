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
}

export interface IRolePermissionAddition {
  role: WorkspaceRole | "owner" | "admin" | "operations_manager" | "project_manager" | "qa" | "developer" | "member" | "guest";
  permissions: string[];
}

export interface IWorkspace extends Document {
  name: string;
  logo?: string;
  owner: Schema.Types.ObjectId;
  members: IWorkspaceMember[];
  rolePermissionAdditions?: IRolePermissionAddition[];
  lastAnnouncementTime?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide workspace name"],
      trim: true,
      maxlength: [100, "Workspace name cannot exceed 100 characters"]
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
        ]
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
