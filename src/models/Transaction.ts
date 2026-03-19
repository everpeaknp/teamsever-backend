import mongoose, { Document } from "mongoose";

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  transactionUuid: string;
  amount: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'esewa';
  esewaRefId?: string;
  esewaTransactionCode?: string;
  metadata?: {
    productCode?: string;
    taxAmount?: number;
    serviceCharge?: number;
    deliveryCharge?: number;
    memberCount?: number;
    pricePerSeat?: number;
    billingCycle?: 'monthly' | 'annual';
    discountPercentage?: number;
    discountedPricePerSeat?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
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
  },
  { 
    timestamps: true 
  }
);

// Indexes for efficient queries
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });

const TransactionModel = mongoose.model<ITransaction>("Transaction", transactionSchema);

// Export for both CommonJS and ES6
module.exports = TransactionModel;
export default TransactionModel;
