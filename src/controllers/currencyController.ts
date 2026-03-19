import { Request, Response } from 'express';
import currencyService from '../services/currency.service';

const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Get current USD to NPR exchange rate
 * @route   GET /api/currency/rate
 * @access  Public
 */
const getExchangeRate = asyncHandler(async (req: Request, res: Response) => {
  const rate = await currencyService.getUSDtoNPRRate();
  const cacheInfo = currencyService.getCacheInfo();

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
const convertCurrency = asyncHandler(async (req: Request, res: Response) => {
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

  const convertedAmount = await currencyService.convertCurrency(
    parseFloat(amount),
    fromCurrency as 'USD' | 'NPR',
    toCurrency as 'USD' | 'NPR'
  );

  res.status(200).json({
    success: true,
    data: {
      originalAmount: parseFloat(amount),
      fromCurrency,
      toCurrency,
      convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimals
      rate: await currencyService.getUSDtoNPRRate()
    }
  });
});

/**
 * @desc    Force refresh exchange rate (admin only)
 * @route   POST /api/currency/refresh
 * @access  Private (Admin)
 */
const refreshExchangeRate = asyncHandler(async (req: Request, res: Response) => {
  const rate = await currencyService.forceRefresh();

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

export {};
