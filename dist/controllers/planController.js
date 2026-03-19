"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Plan = require("../models/Plan");
const asyncHandler = require("../utils/asyncHandler");
/**
 * @desc    Create a new plan
 * @route   POST /api/plans
 * @access  Private (Super User only)
 */
const createPlan = asyncHandler(async (req, res) => {
    const { name, price, baseCurrency, basePrice, pricePerMemberMonthly, pricePerMemberAnnual, discountPercentage, description, features, isActive, parentPlanId } = req.body;
    // Check if user is super user
    if (!req.user.isSuperUser) {
        res.status(403);
        throw new Error("Access denied. Super user privileges required.");
    }
    // Check if plan with same name already exists
    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) {
        res.status(400);
        throw new Error("Plan with this name already exists");
    }
    // Initialize plan features
    let planFeatures = {
        maxWorkspaces: features?.maxWorkspaces || 1,
        maxMembers: features?.maxMembers || 5,
        maxAdmins: features?.maxAdmins || 1,
        maxSpaces: features?.maxSpaces || 10,
        maxLists: features?.maxLists || 50,
        maxFolders: features?.maxFolders || 20,
        maxTasks: features?.maxTasks || 100,
        hasAccessControl: features?.hasAccessControl || false,
        hasGroupChat: features?.hasGroupChat || false,
        messageLimit: features?.messageLimit || 100,
        announcementCooldown: features?.announcementCooldown || 24,
        accessControlTier: features?.accessControlTier || 'none'
    };
    // If parentPlanId is provided, inherit features from parent plan
    if (parentPlanId) {
        const parentPlan = await Plan.findById(parentPlanId);
        if (!parentPlan) {
            res.status(404);
            throw new Error("Parent plan not found");
        }
        // Merge parent features with new features (new features override parent)
        planFeatures = {
            maxWorkspaces: features?.maxWorkspaces !== undefined ? features.maxWorkspaces : parentPlan.features.maxWorkspaces,
            maxMembers: features?.maxMembers !== undefined ? features.maxMembers : parentPlan.features.maxMembers,
            maxAdmins: features?.maxAdmins !== undefined ? features.maxAdmins : parentPlan.features.maxAdmins,
            maxSpaces: features?.maxSpaces !== undefined ? features.maxSpaces : parentPlan.features.maxSpaces,
            maxLists: features?.maxLists !== undefined ? features.maxLists : parentPlan.features.maxLists,
            maxFolders: features?.maxFolders !== undefined ? features.maxFolders : parentPlan.features.maxFolders,
            maxTasks: features?.maxTasks !== undefined ? features.maxTasks : parentPlan.features.maxTasks,
            hasAccessControl: features?.hasAccessControl !== undefined ? features.hasAccessControl : parentPlan.features.hasAccessControl,
            hasGroupChat: features?.hasGroupChat !== undefined ? features.hasGroupChat : parentPlan.features.hasGroupChat,
            messageLimit: features?.messageLimit !== undefined ? features.messageLimit : parentPlan.features.messageLimit,
            announcementCooldown: features?.announcementCooldown !== undefined ? features.announcementCooldown : parentPlan.features.announcementCooldown,
            accessControlTier: features?.accessControlTier !== undefined ? features.accessControlTier : parentPlan.features.accessControlTier
        };
    }
    // Prepare plan data with currency fields
    const planData = {
        name,
        description,
        parentPlanId: parentPlanId || null,
        features: planFeatures,
        isActive: isActive !== undefined ? isActive : true
    };
    // Handle new billing cycle pricing
    if (pricePerMemberMonthly !== undefined) {
        planData.pricePerMemberMonthly = pricePerMemberMonthly;
    }
    if (pricePerMemberAnnual !== undefined) {
        planData.pricePerMemberAnnual = pricePerMemberAnnual;
    }
    if (discountPercentage !== undefined) {
        planData.discountPercentage = discountPercentage;
    }
    // Handle legacy currency fields - basePrice takes precedence
    if (basePrice !== undefined) {
        planData.basePrice = basePrice;
        planData.price = basePrice; // Keep price in sync
    }
    else if (price !== undefined) {
        planData.price = price;
        planData.basePrice = price; // Keep basePrice in sync
    }
    if (baseCurrency !== undefined) {
        planData.baseCurrency = baseCurrency;
    }
    const plan = await Plan.create(planData);
    res.status(201).json({
        success: true,
        data: plan
    });
});
/**
 * @desc    Get all plans
 * @route   GET /api/plans
 * @access  Public
 */
const getPlans = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query;
    // Build query
    const query = {};
    // By default, only show active plans unless includeInactive is true
    if (includeInactive !== 'true') {
        query.isActive = true;
    }
    const plans = await Plan.find(query).sort({ price: 1 });
    res.status(200).json({
        success: true,
        count: plans.length,
        data: plans
    });
});
/**
 * @desc    Get single plan by ID
 * @route   GET /api/plans/:id
 * @access  Public
 */
const getPlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
        res.status(404);
        throw new Error("Plan not found");
    }
    res.status(200).json({
        success: true,
        data: plan
    });
});
/**
 * @desc    Update a plan
 * @route   PUT /api/plans/:id
 * @access  Private (Super User only)
 */
const updatePlan = asyncHandler(async (req, res) => {
    console.log('[updatePlan] Request body:', req.body);
    // Check if user is super user
    if (!req.user.isSuperUser) {
        res.status(403);
        throw new Error("Access denied. Super user privileges required.");
    }
    let plan = await Plan.findById(req.params.id);
    if (!plan) {
        res.status(404);
        throw new Error("Plan not found");
    }
    console.log('[updatePlan] Current plan:', {
        name: plan.name,
        pricePerMemberMonthly: plan.pricePerMemberMonthly,
        pricePerMemberAnnual: plan.pricePerMemberAnnual
    });
    const { name, price, baseCurrency, basePrice, pricePerMemberMonthly, pricePerMemberAnnual, discountPercentage, description, features, isActive } = req.body;
    // Check if updating name to an existing plan name
    if (name && name !== plan.name) {
        const existingPlan = await Plan.findOne({ name });
        if (existingPlan) {
            res.status(400);
            throw new Error("Plan with this name already exists");
        }
    }
    // Prepare update object
    const updateData = {
        name,
        description,
        features,
        isActive
    };
    // Handle new billing cycle pricing
    if (pricePerMemberMonthly !== undefined) {
        updateData.pricePerMemberMonthly = pricePerMemberMonthly;
    }
    if (pricePerMemberAnnual !== undefined) {
        updateData.pricePerMemberAnnual = pricePerMemberAnnual;
    }
    if (discountPercentage !== undefined) {
        updateData.discountPercentage = discountPercentage;
    }
    // Handle legacy currency fields
    if (baseCurrency !== undefined) {
        updateData.baseCurrency = baseCurrency;
    }
    if (basePrice !== undefined) {
        updateData.basePrice = basePrice;
        updateData.price = basePrice; // Keep price in sync with basePrice
    }
    else if (price !== undefined) {
        updateData.price = price;
        updateData.basePrice = price; // Keep basePrice in sync with price
    }
    plan = await Plan.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true
    });
    console.log('[updatePlan] Updated plan:', {
        name: plan.name,
        pricePerMemberMonthly: plan.pricePerMemberMonthly,
        pricePerMemberAnnual: plan.pricePerMemberAnnual
    });
    res.status(200).json({
        success: true,
        data: plan
    });
});
/**
 * @desc    Delete a plan
 * @route   DELETE /api/plans/:id
 * @access  Private (Super User only)
 */
const deletePlan = asyncHandler(async (req, res) => {
    // Check if user is super user
    if (!req.user.isSuperUser) {
        res.status(403);
        throw new Error("Access denied. Super user privileges required.");
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
        res.status(404);
        throw new Error("Plan not found");
    }
    // Prevent deletion of Free plan
    if (plan.name.toLowerCase() === 'free' || plan.name.toLowerCase() === 'free plan') {
        res.status(400);
        throw new Error("Cannot delete the Free plan");
    }
    // Check if any users are subscribed to this plan
    const User = require("../models/User");
    const subscribedUsers = await User.countDocuments({ 'subscription.planId': req.params.id });
    if (subscribedUsers > 0) {
        res.status(400);
        throw new Error(`Cannot delete plan. ${subscribedUsers} user(s) are currently subscribed to this plan.`);
    }
    // Delete the plan
    await Plan.findByIdAndDelete(req.params.id);
    res.status(200).json({
        success: true,
        message: "Plan deleted successfully"
    });
});
module.exports = {
    createPlan,
    getPlans,
    getPlan,
    updatePlan,
    deletePlan
};
