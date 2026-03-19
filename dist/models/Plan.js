"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const planSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Legacy fields - kept for backward compatibility
    price: {
        type: Number,
        required: false,
        min: 0,
        default: 0
    },
    baseCurrency: {
        type: String,
        enum: ['USD', 'NPR'],
        default: 'NPR',
        required: true
    },
    basePrice: {
        type: Number,
        required: false,
        min: 0,
        default: 0
    },
    // New pricing fields
    pricePerMemberMonthly: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    pricePerMemberAnnual: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    discountPercentage: {
        type: Number,
        required: false,
        min: 0,
        max: 100,
        default: 0
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    parentPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        default: null
    },
    features: {
        maxWorkspaces: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 1
        },
        maxAdmins: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 1
        },
        maxSpaces: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 10
        },
        maxLists: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 50
        },
        maxFolders: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 20
        },
        maxTasks: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 100
        },
        hasAccessControl: {
            type: Boolean,
            required: true,
            default: false
        },
        hasGroupChat: {
            type: Boolean,
            required: true,
            default: false
        },
        messageLimit: {
            type: Number,
            required: true,
            min: -1, // -1 means unlimited
            default: 100
        },
        announcementCooldown: {
            type: Number,
            required: true,
            min: 0, // in hours
            default: 24
        },
        accessControlTier: {
            type: String,
            enum: ['none', 'basic', 'pro', 'advanced'],
            required: true,
            default: 'none'
        },
        // Custom Roles (Pro Feature)
        canUseCustomRoles: {
            type: Boolean,
            required: false,
            default: false
        },
        maxCustomRoles: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        // Custom Tables (Pro Feature)
        canCreateTables: {
            type: Boolean,
            required: false,
            default: false
        },
        maxTablesCount: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        maxRowsLimit: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        maxColumnsLimit: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        // Files & Documents (Pro Feature)
        maxFiles: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        maxDocuments: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        },
        // Direct Messages (Pro Feature)
        maxDirectMessagesPerUser: {
            type: Number,
            required: false,
            min: -1, // -1 means unlimited
            default: -1
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});
// Index for active plans
planSchema.index({ isActive: 1 });
module.exports = mongoose.model("Plan", planSchema);
