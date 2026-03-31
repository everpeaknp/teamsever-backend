/**
 * @swagger
 * tags:
 *   name: "System & Admin"
 *   description: System and administrative endpoints
 * 
 * /api/currency/rate:
 *   get:
 *     summary: Get current USD to NPR exchange rate
 *     description: Returns the current exchange rate with caching information. Uses stale-while-revalidate strategy (12-hour cache).
 *     tags: ["System & Admin"]
 *     responses:
 *       200:
 *         description: Exchange rate retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     rate:
 *                       type: number
 *                       description: Current USD to NPR exchange rate
 *                       example: 132.5
 *                     fromCurrency:
 *                       type: string
 *                       example: "USD"
 *                     toCurrency:
 *                       type: string
 *                       example: "NPR"
 *                     cached:
 *                       type: boolean
 *                       description: Whether the rate is from cache
 *                       example: true
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the cached rate expires
 *                       example: "2024-01-15T12:00:00Z"
 *       500:
 *         description: Failed to fetch exchange rate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch exchange rate"
 * 
 * /api/currency/convert:
 *   post:
 *     summary: Convert amount between USD and NPR
 *     description: Converts a given amount from one currency to another using the current exchange rate
 *     tags: ["System & Admin"]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - fromCurrency
 *               - toCurrency
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to convert
 *                 example: 100
 *               fromCurrency:
 *                 type: string
 *                 enum: [USD, NPR]
 *                 description: Source currency
 *                 example: "USD"
 *               toCurrency:
 *                 type: string
 *                 enum: [USD, NPR]
 *                 description: Target currency
 *                 example: "NPR"
 *     responses:
 *       200:
 *         description: Conversion successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     originalAmount:
 *                       type: number
 *                       example: 100
 *                     fromCurrency:
 *                       type: string
 *                       example: "USD"
 *                     toCurrency:
 *                       type: string
 *                       example: "NPR"
 *                     convertedAmount:
 *                       type: number
 *                       description: Converted amount
 *                       example: 13250
 *                     rate:
 *                       type: number
 *                       description: Exchange rate used
 *                       example: 132.5
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid currency or amount"
 *       500:
 *         description: Conversion failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 * 
 * /api/currency/refresh:
 *   post:
 *     summary: Force refresh exchange rate (Admin only)
 *     description: Forces a refresh of the cached exchange rate. Requires super admin privileges.
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exchange rate refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Exchange rate refreshed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rate:
 *                       type: number
 *                       example: 132.5
 *                     fromCurrency:
 *                       type: string
 *                       example: "USD"
 *                     toCurrency:
 *                       type: string
 *                       example: "NPR"
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       403:
 *         description: Forbidden - Super admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       500:
 *         description: Failed to refresh exchange rate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */

export {};
