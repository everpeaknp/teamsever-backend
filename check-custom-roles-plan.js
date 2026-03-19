/**
 * Check custom roles configuration in plans
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('./dist/models/Plan');
const User = require('./dist/models/User');
const PlanInheritanceService = require('./dist/services/planInheritanceService').default;

async function checkCustomRolesPlans() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all plans
        const plans = await Plan.find({ isActive: true }).sort('name');
        
        console.log('📋 PLANS WITH CUSTOM ROLES CONFIGURATION:\n');
        console.log('='.repeat(80));
        
        for (const plan of plans) {
            console.log(`\n📦 Plan: ${plan.name}`);
            console.log(`   ID: ${plan._id}`);
            console.log(`   Parent Plan ID: ${plan.parentPlanId || 'None'}`);
            console.log(`   Price: $${plan.price}/${plan.billingCycle}`);
            console.log('\n   Raw Features:');
            console.log(`   - canUseCustomRoles: ${plan.features.canUseCustomRoles}`);
            console.log(`   - maxCustomRoles: ${plan.features.maxCustomRoles}`);
            
            // Resolve features with inheritance
            const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
            console.log('\n   Resolved Features (with inheritance):');
            console.log(`   - canUseCustomRoles: ${resolvedFeatures.canUseCustomRoles}`);
            console.log(`   - maxCustomRoles: ${resolvedFeatures.maxCustomRoles}`);
            console.log('-'.repeat(80));
        }
        
        // Check if any users have these plans
        console.log('\n\n👥 USERS WITH PAID SUBSCRIPTIONS:\n');
        console.log('='.repeat(80));
        
        const usersWithPlans = await User.find({
            'subscription.isPaid': true
        }).populate('subscription.planId').limit(5);
        
        for (const user of usersWithPlans) {
            console.log(`\n👤 User: ${user.name} (${user.email})`);
            console.log(`   User ID: ${user._id}`);
            if (user.subscription && user.subscription.planId) {
                const plan = user.subscription.planId;
                console.log(`   Plan: ${plan.name}`);
                console.log(`   Plan ID: ${plan._id}`);
                
                const resolvedFeatures = await PlanInheritanceService.resolveFeatures(plan);
                console.log(`   Can Use Custom Roles: ${resolvedFeatures.canUseCustomRoles}`);
                console.log(`   Max Custom Roles: ${resolvedFeatures.maxCustomRoles}`);
            }
            console.log('-'.repeat(80));
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

checkCustomRolesPlans();
