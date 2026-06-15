const express = require("express");
const { getPrivacyPolicy, getTermsAndConditions } = require("../controllers/legalController");

const router = express.Router();

/**
 * @swagger
 * /api/legal/privacy-policy:
 *   get:
 *     summary: Get Privacy Policy
 *     description: Returns the current Privacy Policy document for web, mobile, and app store compliance views.
 *     tags: ["0.2 Legal Pages"]
 *     responses:
 *       200:
 *         description: Privacy Policy retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/LegalPageResponse"
 */
router.get("/privacy-policy", getPrivacyPolicy);

/**
 * @swagger
 * /api/legal/terms-and-conditions:
 *   get:
 *     summary: Get Terms and Conditions
 *     description: Returns the current Terms and Conditions document for web, mobile, and app store compliance views.
 *     tags: ["0.2 Legal Pages"]
 *     responses:
 *       200:
 *         description: Terms and Conditions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/LegalPageResponse"
 */
router.get("/terms-and-conditions", getTermsAndConditions);

module.exports = router;
export {};
