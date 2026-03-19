"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const { createPlan, getPlans, getPlan, updatePlan, deletePlan } = require("../controllers/planController");
const { protect } = require("../middlewares/authMiddleware");
const validate = require("../utils/validation");
const { createPlanSchema, updatePlanSchema } = require("../validators/planValidators");
const router = express.Router();
/**
 * @swagger
 * /api/plans:
 *   post:
 *     summary: Create a new plan
 *     description: Create a new subscription plan (Super User only)
 *     tags: [Plans]
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
 *               - price
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Pro Plan"
 *               price:
 *                 type: number
 *                 example: 29.99
 *               description:
 *                 type: string
 *                 example: "Professional plan with advanced features"
 *               features:
 *                 type: object
 *                 properties:
 *                   maxWorkspaces:
 *                     type: number
 *                     example: 5
 *                   maxMembers:
 *                     type: number
 *                     example: 50
 *                   hasAccessControl:
 *                     type: boolean
 *                     example: true
 *                   messageLimit:
 *                     type: number
 *                     example: 10000
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       400:
 *         description: Validation error or plan already exists
 *       403:
 *         description: Access denied - Super user privileges required
 *   get:
 *     summary: Get all plans
 *     description: Retrieve all subscription plans (active by default)
 *     tags: [Plans]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Include inactive plans in the response
 *     responses:
 *       200:
 *         description: List of plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Plan'
 */
router.post("/", protect, validate(createPlanSchema), createPlan);
router.get("/", getPlans);
/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     summary: Get a single plan
 *     description: Retrieve a specific plan by ID
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan details
 *       404:
 *         description: Plan not found
 *   put:
 *     summary: Update a plan
 *     description: Update an existing plan (Super User only)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               features:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Plan not found
 *   delete:
 *     summary: Deactivate a plan
 *     description: Soft delete a plan by setting isActive to false (Super User only)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan deactivated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Plan not found
 */
router.get("/:id", getPlan);
router.put("/:id", protect, validate(updatePlanSchema), updatePlan);
router.delete("/:id", protect, deletePlan);
module.exports = router;
