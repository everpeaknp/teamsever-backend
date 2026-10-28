const express = require("express");
const {
  getAdminUsers,
  updateUserSubscription,
  getFinancialAnalytics,
  getSystemSettings,
  updateSystemSettings
} = require("../controllers/superAdminController");
const { protect } = require("../middlewares/authMiddleware");
const productUpdates = require("../controllers/productUpdateController");
const multer = require("multer");
const { PRODUCT_UPDATE_IMAGE_MAX_BYTES, validateProductUpdateImage } = require("../utils/productUpdateImagePolicy");
const productUpdateImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_UPDATE_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req: any, file: any, callback: any) => {
    const error = validateProductUpdateImage(file.mimetype, 1);
    if (!error) return callback(null, true);
    callback(new Error(error));
  },
}).single("file");

const router = express.Router();

// Public route to get branding settings
router.get("/settings", getSystemSettings);

// All other routes require authentication and super user privileges
router.use(protect);

/**
 * @swagger
 * /api/super-admin/users:
 *   get:
 *     summary: Get all workspace admins/owners
 *     description: Retrieve all workspace owners with their full subscription details. Restricted to Super Admins only.
 *     tags: ["9.5 Admin — Super Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of admin users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AdminUserListResponse"
 *       403:
 *         description: Forbidden - Super Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/users", getAdminUsers);

/**
 * @swagger
 * /api/super-admin/users/{userId}/subscription:
 *   patch:
 *     summary: Update user subscription
 *     description: Manually override or update a user's subscription status and plan.
 *     tags: ["9.5 Admin — Super Admin"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPaid:
 *                 type: boolean
 *                 example: true
 *               planId:
 *                 type: string
 *                 example: "69bbf827a96fe78f716751aa"
 *               status:
 *                 type: string
 *                 enum: [trial, active, expired]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiResponse"
 *       403:
 *         description: Forbidden - Super Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: User or Plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.patch("/users/:userId/subscription", updateUserSubscription);

/**
 * @swagger
 * /api/super-admin/analytics:
 *   get:
 *     summary: Get system-wide financial analytics
 *     description: Retrieve global revenue, conversion rates, and user signup trends.
 *     tags: ["9.5 Admin — Super Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/FinancialAnalyticsResponse"
 *       403:
 *         description: Forbidden - Super Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.get("/analytics", getFinancialAnalytics);

/**
 * @swagger
 * /api/super-admin/settings:
 *   get:
 *     summary: Get global system settings
 *     description: Retrieve system-wide configuration settings like support contact numbers.
 *     tags: ["9.5 Admin — Super Admin"]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SystemSettingsResponse"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   put:
 *     summary: Update global system settings
 *     description: Update system-wide configuration.
 *     tags: ["9.5 Admin — Super Admin"]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               whatsappContactNumber:
 *                 type: string
 *                 example: "+9779800000000"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SystemSettingsResponse"
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 */
router.put("/settings", updateSystemSettings);

router.get("/product-updates", productUpdates.adminList);
router.post("/product-updates", productUpdates.adminSave);
router.delete("/product-updates/:id", productUpdates.adminDelete);
router.post("/product-updates/upload-image", (req: any, res: any, next: any) => {
  productUpdateImageUpload(req, res, (error: any) => {
    if (error) return res.status(400).json({ success: false, message: error.message || "Image upload failed." });
    next();
  });
}, productUpdates.uploadSlideImage);
router.get("/product-updates/next", productUpdates.getNextForUser);
router.post("/product-updates/:id/seen", productUpdates.markSeen);

const { migrateWebhooks } = require("../controllers/superAdminController");
router.post("/migrate-webhooks", migrateWebhooks);

module.exports = router;

export {};
