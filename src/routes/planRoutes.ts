const express = require("express");
const {
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan
} = require("../controllers/planController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const {
  createPlanSchema,
  updatePlanSchema
} = require("../validators/planValidators");

const router = express.Router();

/**
 * @swagger
 * /api/plans:
 *   post:
 *     summary: Create a new plan
 *     description: Create a new subscription plan with specific feature limits. Restricted to Super Admins.
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
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Pro Plan"
 *               description:
 *                 type: string
 *                 example: "Professional plan with advanced features"
 *               baseCurrency:
 *                 type: string
 *                 enum: [NPR, USD]
 *                 default: NPR
 *               pricePerMemberMonthly:
 *                 type: number
 *                 example: 300
 *               pricePerMemberAnnual:
 *                 type: number
 *                 example: 3000
 *               basePrice:
 *                 type: number
 *                 description: Legacy base price field for backward compatibility
 *               features:
 *                 type: object
 *                 properties:
 *                   maxWorkspaces:
 *                     type: number
 *                     example: 5
 *                   maxAdmins:
 *                     type: number
 *                     example: 2
 *                   maxSpaces:
 *                     type: number
 *                     example: 20
 *                   maxLists:
 *                     type: number
 *                     example: 100
 *                   maxTasks:
 *                     type: number
 *                     example: 1000
 *                   hasAccessControl:
 *                     type: boolean
 *                     example: true
 *                   accessControlTier:
 *                     type: string
 *                     enum: [none, basic, pro, advanced]
 *                     example: "pro"
 *                   hasGroupChat:
 *                     type: boolean
 *                     example: true
 *                   messageLimit:
 *                     type: number
 *                     example: -1
 *                   canUseCustomRoles:
 *                     type: boolean
 *                     example: true
 *                   canCreateTables:
 *                     type: boolean
 *                     example: true
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Plan created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f716751aa"
 *                 name: "Pro Plan"
 *       403:
 *         description: Forbidden
 *   get:
 *     summary: Get all plans
 *     description: Retrieve all subscription plans. Active plans are returned by default.
 *     tags: ["System & Admin"]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Whether to include deactivated plans
 *     responses:
 *       200:
 *         description: List of plans retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - _id: "69bbf827a96fe78f716751aa"
 *                   name: "Pro Plan"
 *                   pricePerMemberMonthly: 300
 *                   isActive: true
 */
router.post("/", protect, validate(createPlanSchema), createPlan);
router.get("/", getPlans);

/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Get a single plan
 *     description: Retrieve full details of a specific subscription plan by its ID.
 *     tags: ["System & Admin"]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 _id: "69bbf827a96fe78f716751aa"
 *                 name: "Pro Plan"
 *                 features: { ... }
 *       404:
 *         description: Plan not found
 *   put:
 *     summary: Update a plan
 *     description: Update features, pricing, or status of an existing plan. Restricted to Super Admins.
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
 *   delete:
 *     summary: Deactivate or Delete a plan
 *     description: Marks a plan as inactive or removes it if no users are subscribed. Restricted to Super Admins.
 *     tags: ["System & Admin"]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan deactivated/deleted successfully
 *       403:
 *         description: Forbidden
 */
router.get("/:id", getPlan);
router.put("/:id", protect, validate(updatePlanSchema), updatePlan);
router.delete("/:id", protect, deletePlan);

module.exports = router;

export {};
