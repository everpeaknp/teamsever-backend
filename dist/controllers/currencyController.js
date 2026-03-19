"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const currency_service_1 = __importDefault(require("../services/currency.service"));
const asyncHandler = require('../utils/asyncHandler');
/**
 * @desc    Get current USD to NPR exchange rate
 * @route   GET /api/currency/rate
 * @access  Public
 */
const getExchangeRate = asyncHandler(async (req, res) => {
    const rate = await currency_service_1.default.getUSDtoNPRRate();
    const cacheInfo = currency_service_1.default.getCacheInfo();
    res.status(200).json({
        success: true,
        data: {
            rate,
            fromCurrency: 'USD',
            toCurrency: 'NPR',
            cached: cacheInfo.hasCache,
            expiresAt: cacheInfo.expiresAt
        }
    });
});
/**
 * @desc    Convert amount between currencies
 * @route   POST /api/currency/convert
 * @access  Public
 */
const convertCurrency = asyncHandler(async (req, res) => {
    const { amount, fromCurrency, toCurrency } = req.body;
    if (!amount || !fromCurrency || !toCurrency) {
        return res.status(400).json({
            success: false,
            message: 'Please provide amount, fromCurrency, and toCurrency'
        });
    }
    if (!['USD', 'NPR'].includes(fromCurrency) || !['USD', 'NPR'].includes(toCurrency)) {
        return res.status(400).json({
            success: false,
            message: 'Currency must be either USD or NPR'
        });
    }
    const convertedAmount = await currency_service_1.default.convertCurrency(parseFloat(amount), fromCurrency, toCurrency);
    res.status(200).json({
        success: true,
        data: {
            originalAmount: parseFloat(amount),
            fromCurrency,
            toCurrency,
            convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
            rate: await currency_service_1.default.getUSDtoNPRRate()
        }
    });
});
/**
 * @desc    Force refresh exchange rate (admin only)
 * @route   POST /api/currency/refresh
 * @access  Private (Admin)
 */
const refreshExchangeRate = asyncHandler(async (req, res) => {
    const rate = await currency_service_1.default.forceRefresh();
    res.status(200).json({
        success: true,
        message: 'Exchange rate refreshed successfully',
        data: {
            rate,
            fromCurrency: 'USD',
            toCurrency: 'NPR'
        }
    });
});
module.exports = {
    getExchangeRate,
    convertCurrency,
    refreshExchangeRate
};
