const express = require('express');
const router = express.Router();
const { getExchangeRate, convertCurrency, refreshExchangeRate } = require('../controllers/currencyController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/currency/rate
 * @desc    Get current USD to NPR exchange rate
 * @access  Public
 */
router.get('/rate', getExchangeRate);

/**
 * @route   POST /api/currency/convert
 * @desc    Convert amount between currencies
 * @access  Public
 */
router.post('/convert', convertCurrency);

/**
 * @route   POST /api/currency/refresh
 * @desc    Force refresh exchange rate (admin only)
 * @access  Private
 */
router.post('/refresh', protect, refreshExchangeRate);

module.exports = router;
export {};
