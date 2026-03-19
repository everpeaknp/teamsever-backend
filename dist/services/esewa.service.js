"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
/**
 * eSewa v2 Payment Service
 * Handles payment initiation, signature generation, and verification
 * Documentation: https://developer.esewa.com.np
 */
class EsewaService {
    constructor() {
        this.config = {
            merchantCode: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
            secretKey: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q',
            paymentUrl: process.env.ESEWA_PAYMENT_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
            statusUrl: process.env.ESEWA_STATUS_URL || 'https://rc-epay.esewa.com.np/api/epay/transaction/status/',
            successUrl: process.env.ESEWA_SUCCESS_URL || `${process.env.FRONTEND_URL}/payment/success`,
            failureUrl: process.env.ESEWA_FAILURE_URL || `${process.env.FRONTEND_URL}/payment/failure`
        };
    }
    /**
     * Generate HMAC SHA256 signature for eSewa payment
     * @param message - The message string to sign
     * @returns Base64 encoded signature
     */
    generateSignature(message) {
        const hmac = crypto_1.default.createHmac('sha256', this.config.secretKey);
        hmac.update(message);
        return hmac.digest('base64');
    }
    /**
     * Prepare payment request for eSewa
     * @param amount - Base amount (without tax/charges)
     * @param txUuid - Unique transaction UUID
     * @returns EsewaPaymentRequest object with signature
     */
    preparePayment(amount, txUuid) {
        // eSewa v2 requires these fields (can be 0)
        const taxAmount = 0;
        const serviceCharge = 0;
        const deliveryCharge = 0;
        const totalAmount = amount + taxAmount + serviceCharge + deliveryCharge;
        // Generate signature message (NO SPACES - critical!)
        const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${txUuid},product_code=${this.config.merchantCode}`;
        const signature = this.generateSignature(signatureMessage);
        const paymentRequest = {
            amount: amount,
            tax_amount: taxAmount,
            product_service_charge: serviceCharge,
            product_delivery_charge: deliveryCharge,
            total_amount: totalAmount,
            transaction_uuid: txUuid,
            product_code: this.config.merchantCode,
            success_url: this.config.successUrl,
            failure_url: this.config.failureUrl,
            signed_field_names: 'total_amount,transaction_uuid,product_code',
            signature: signature
        };
        return paymentRequest;
    }
    /**
     * Verify payment signature from eSewa callback
     * @param data - Payment data from eSewa
     * @returns true if signature is valid
     */
    verifySignature(data) {
        try {
            const { signed_field_names, signature, ...otherData } = data;
            // Build message from signed fields
            const fields = signed_field_names.split(',');
            const messageParts = fields.map(field => {
                const value = otherData[field];
                return `${field}=${value}`;
            });
            const message = messageParts.join(',');
            // Generate expected signature
            const expectedSignature = this.generateSignature(message);
            return signature === expectedSignature;
        }
        catch (error) {
            console.error('[eSewa] Signature verification error:', error);
            return false;
        }
    }
    /**
     * Verify payment status with eSewa API
     * @param txUuid - Transaction UUID
     * @param totalAmount - Total amount paid
     * @returns true if payment is complete
     */
    async verifyStatus(txUuid, totalAmount) {
        try {
            const url = `${this.config.statusUrl}?product_code=${this.config.merchantCode}&total_amount=${totalAmount}&transaction_uuid=${txUuid}`;
            console.log('[eSewa] Verifying payment status:', {
                txUuid,
                totalAmount,
                url
            });
            const response = await axios_1.default.get(url);
            console.log('[eSewa] Status API response:', response.data);
            // Payment is valid only if status is COMPLETE
            if (response.data.status === 'COMPLETE') {
                return true;
            }
            console.warn('[eSewa] Payment not complete:', response.data.status);
            return false;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error('[eSewa] Status verification failed:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                });
            }
            else {
                console.error('[eSewa] Status verification error:', error);
            }
            return false;
        }
    }
    /**
     * Get eSewa payment form URL
     * @returns Payment form URL
     */
    getPaymentUrl() {
        return this.config.paymentUrl;
    }
    /**
     * Get merchant code
     * @returns Merchant code
     */
    getMerchantCode() {
        return this.config.merchantCode;
    }
}
// Export singleton instance
const esewaService = new EsewaService();
exports.default = esewaService;
// Also export for CommonJS
module.exports = esewaService;
