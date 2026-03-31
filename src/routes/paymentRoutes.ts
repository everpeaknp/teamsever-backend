export {};
const express = require('express');
const router = express.Router();
const authMiddlewareModule = require('../middlewares/authMiddleware');
const authMiddleware = authMiddlewareModule.protect || authMiddlewareModule;
const paymentController = require('../controllers/payment.controller');

const {
  initiatePayment,
  verifyPayment,
  getTransactions,
  getTransaction
} = paymentController;

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: eSewa payment integration for plan upgrades
 */

/**
 * @swagger
 * /api/payment/initiate:
 *   post:
 *     summary: Initiate eSewa payment for plan upgrade
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: ID of the plan to purchase
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionId:
 *                       type: string
 *                     transactionUuid:
 *                       type: string
 *                     paymentRequest:
 *                       type: object
 *                     paymentUrl:
 *                       type: string
 *                     plan:
 *                       type: object
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post('/initiate', authMiddleware, initiatePayment);

/**
 * @swagger
 * /api/payment/verify:
 *   post:
 *     summary: Verify eSewa payment and activate plan
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64 encoded payment data from eSewa
 *     responses:
 *       200:
 *         description: Payment verified and plan activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     transaction:
 *                       type: object
 *                     subscription:
 *                       type: object
 *       400:
 *         description: Invalid payment data or verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.post('/verify', authMiddleware, verifyPayment);

/**
 * @swagger
 * /api/payment/transactions:
 *   get:
 *     summary: Get user's payment transactions
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get('/transactions', authMiddleware, getTransactions);

/**
 * @swagger
 * /api/payment/transaction/{transactionId}:
 *   get:
 *     summary: Get transaction details
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get('/transaction/:transactionId', authMiddleware, getTransaction);

module.exports = router;
