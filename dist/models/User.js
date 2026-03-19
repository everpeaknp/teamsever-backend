"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    googleId: { type: String },
    isSuperUser: {
        type: Boolean,
        default: false
    },
    passwordResetToken: {
        type: String
    },
    passwordResetTokenExpires: {
        type: Date
    },
    subscription: {
        planId: {
            type: mongoose_1.default.Schema.Types.ObjectId,
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
        }
    }
}, { timestamps: true });
const UserModel = mongoose_1.default.model("User", userSchema);
// Export for both CommonJS and ES6
module.exports = UserModel;
exports.default = UserModel;
