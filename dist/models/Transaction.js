"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const transactionSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    planId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true
    },
    transactionUuid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending',
        required: true,
        index: true
    },
    paymentMethod: {
        type: String,
        enum: ['esewa'],
        default: 'esewa',
        required: true
    },
    esewaRefId: {
        type: String
    },
    esewaTransactionCode: {
        type: String
    },
    metadata: {
        productCode: String,
        taxAmount: Number,
        serviceCharge: Number,
        deliveryCharge: Number,
        memberCount: Number,
        pricePerSeat: Number,
        billingCycle: {
            type: String,
            enum: ['monthly', 'annual']
        },
        discountPercentage: Number,
        discountedPricePerSeat: Number
    },
    completedAt: {
        type: Date
    }
}, {
    timestamps: true
});
// Indexes for efficient queries
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
const TransactionModel = mongoose_1.default.model("Transaction", transactionSchema);
// Export for both CommonJS and ES6
module.exports = TransactionModel;
exports.default = TransactionModel;
