"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const Transaction = require('../models/Transaction');
const Plan = require('../models/Plan');
const User = require('../models/User');
const esewaServiceModule = require('../services/esewa.service');
const esewaService = esewaServiceModule.default || esewaServiceModule;
/**
 * Payment Controller
 * Handles eSewa payment initiation and verification
 */
/**
 * @route   POST /api/payment/initiate
 * @desc    Initiate eSewa payment for plan upgrade
 * @access  Private
 */
const initiatePayment = async (req, res) => {
    try {
        const { planId, memberCount = 1, billingCycle = 'annual' } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }
        if (!planId) {
            res.status(400).json({
                success: false,
                message: 'Plan ID is required'
            });
            return;
        }
        // Validate member count
        if (memberCount < 1 || memberCount > 1000) {
            res.status(400).json({
                success: false,
                message: 'Member count must be between 1 and 1000'
            });
            return;
        }
        // Validate billing cycle
        if (!['monthly', 'annual'].includes(billingCycle)) {
            res.status(400).json({
                success: false,
                message: 'Billing cycle must be either "monthly" or "annual"'
            });
            return;
        }
        // Fetch plan details
        const plan = await Plan.findById(planId);
        if (!plan) {
            res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
            return;
        }
        if (!plan.isActive) {
            res.status(400).json({
                success: false,
                message: 'Plan is not active'
            });
            return;
        }
        // Get price based on billing cycle
        const pricePerSeat = billingCycle === 'monthly'
            ? plan.pricePerMemberMonthly
            : plan.pricePerMemberAnnual;
        if (pricePerSeat <= 0) {
            res.status(400).json({
                success: false,
                message: 'Cannot process payment for free plan'
            });
            return;
        }
        // Calculate discount
        const discountPercentage = plan.discountPercentage || 0;
        const discountMultiplier = (100 - discountPercentage) / 100;
        const discountedPricePerSeat = pricePerSeat * discountMultiplier;
        // Calculate total amount
        const totalAmount = Math.round(discountedPricePerSeat * memberCount);
        // Generate unique transaction UUID with billing cycle and member count
        const transactionUuid = `${userId}-${planId}-${billingCycle.toUpperCase()}-${memberCount}M-${crypto_1.default.randomUUID()}`;
        // Create transaction record with all details
        const transaction = await Transaction.create({
            userId,
            planId,
            transactionUuid,
            amount: pricePerSeat,
            totalAmount: totalAmount,
            status: 'pending',
            paymentMethod: 'esewa',
            metadata: {
                productCode: `${esewaService.getMerchantCode()}_${plan.name.toUpperCase()}_${billingCycle.toUpperCase()}_${memberCount}MEMBERS`,
                taxAmount: 0,
                serviceCharge: 0,
                deliveryCharge: 0,
                memberCount: memberCount,
                pricePerSeat: pricePerSeat,
                billingCycle: billingCycle,
                discountPercentage: discountPercentage,
                discountedPricePerSeat: discountedPricePerSeat
            }
        });
        // Prepare eSewa payment request with total amount
        const paymentRequest = esewaService.preparePayment(totalAmount, transactionUuid);
        res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
                transactionId: transaction._id,
                transactionUuid,
                paymentRequest,
                paymentUrl: esewaService.getPaymentUrl(),
                plan: {
                    id: plan._id,
                    name: plan.name,
                    billingCycle,
                    pricePerSeat,
                    discountPercentage,
                    discountedPricePerSeat,
                    memberCount,
                    totalAmount
                }
            }
        });
    }
    catch (error) {
        console.error('[Payment] Initiation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error.message
        });
    }
};
/**
 * @route   POST /api/payment/verify
 * @desc    Verify eSewa payment and activate plan
 * @access  Private
 */
const verifyPayment = async (req, res) => {
    try {
        const { data: encodedData } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }
        if (!encodedData) {
            res.status(400).json({
                success: false,
                message: 'Payment data is required'
            });
            return;
        }
        // Decode Base64 payment data
        let paymentData;
        try {
            const decodedString = Buffer.from(encodedData, 'base64').toString('utf-8');
            paymentData = JSON.parse(decodedString);
        }
        catch (error) {
            console.error('[Payment] Failed to decode payment data:', error);
            res.status(400).json({
                success: false,
                message: 'Invalid payment data format'
            });
            return;
        }
        const { transaction_uuid, total_amount, transaction_code, status } = paymentData;
        if (!transaction_uuid) {
            res.status(400).json({
                success: false,
                message: 'Transaction UUID is missing'
            });
            return;
        }
        // Find transaction
        const transaction = await Transaction.findOne({ transactionUuid: transaction_uuid });
        if (!transaction) {
            res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
            return;
        }
        // Verify transaction belongs to user
        if (transaction.userId.toString() !== userId) {
            res.status(403).json({
                success: false,
                message: 'Unauthorized access to transaction'
            });
            return;
        }
        // Check if already processed
        if (transaction.status === 'completed') {
            res.status(400).json({
                success: false,
                message: 'Transaction already processed'
            });
            return;
        }
        // Verify signature (optional but recommended)
        const isSignatureValid = esewaService.verifySignature(paymentData);
        if (!isSignatureValid) {
            // Continue anyway as we'll verify with status API
        }
        // Verify with eSewa Status API (double-check)
        const isStatusValid = await esewaService.verifyStatus(transaction_uuid, parseFloat(total_amount));
        if (!isStatusValid) {
            // Update transaction as failed
            transaction.status = 'failed';
            transaction.esewaTransactionCode = transaction_code;
            await transaction.save();
            res.status(400).json({
                success: false,
                message: 'Payment verification failed. Please contact support.'
            });
            return;
        }
        // Payment verified successfully - Update transaction
        transaction.status = 'completed';
        transaction.esewaRefId = paymentData.ref_id || null;
        transaction.esewaTransactionCode = transaction_code;
        transaction.completedAt = new Date();
        await transaction.save();
        // Activate plan for user
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        const plan = await Plan.findById(transaction.planId);
        if (!plan) {
            res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
            return;
        }
        // Calculate expiry date based on billing cycle
        const billingCycle = transaction.metadata?.billingCycle || 'monthly';
        const expiresAt = new Date();
        if (billingCycle === 'annual') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year
        }
        else {
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
        }
        // Get member count and pricing from transaction metadata
        const memberCount = transaction.metadata?.memberCount || 1;
        const pricePerSeat = transaction.metadata?.pricePerSeat || transaction.amount;
        // Update user subscription with all details
        user.subscription = {
            planId: plan._id,
            isPaid: true,
            paidAt: new Date(),
            expiresAt: expiresAt,
            status: 'active',
            billingCycle: billingCycle,
            memberCount: memberCount,
            pricePerSeat: pricePerSeat
        };
        await user.save();
        console.log('[Payment] Plan activated successfully:', {
            userId,
            planId: plan._id,
            planName: plan.name,
            billingCycle,
            memberCount,
            transactionId: transaction._id,
            expiresAt
        });
        res.status(200).json({
            success: true,
            message: 'Payment verified and plan activated successfully',
            data: {
                transaction: {
                    id: transaction._id,
                    uuid: transaction.transactionUuid,
                    status: transaction.status,
                    amount: transaction.totalAmount,
                    completedAt: transaction.completedAt
                },
                subscription: {
                    planId: plan._id,
                    planName: plan.name,
                    status: user.subscription.status,
                    expiresAt: user.subscription.expiresAt
                }
            }
        });
    }
    catch (error) {
        console.error('[Payment] Verification error:', error);
        console.error('[Payment] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error.message
        });
    }
};
/**
 * @route   GET /api/payment/transactions
 * @desc    Get user's payment transactions
 * @access  Private
 */
const getTransactions = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }
        const transactions = await Transaction.find({ userId })
            .populate('planId', 'name price')
            .sort({ createdAt: -1 })
            .limit(50);
        res.status(200).json({
            success: true,
            data: transactions
        });
    }
    catch (error) {
        console.error('[Payment] Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message
        });
    }
};
/**
 * @route   GET /api/payment/transaction/:transactionId
 * @desc    Get transaction details
 * @access  Private
 */
const getTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }
        const transaction = await Transaction.findOne({
            _id: transactionId,
            userId
        }).populate('planId', 'name price description');
        if (!transaction) {
            res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: transaction
        });
    }
    catch (error) {
        console.error('[Payment] Get transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction',
            error: error.message
        });
    }
};
// Export for CommonJS
module.exports = {
    initiatePayment,
    verifyPayment,
    getTransactions,
    getTransaction
};
