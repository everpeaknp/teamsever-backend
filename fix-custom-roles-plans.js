/**
 * Fix custom roles configuration in plans
 * This script enables canUseCustomRoles for plans that have maxCustomRoles set
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('./dist/models/Plan');

async function fixCustomRolesPlans() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all plans
        const plans = await Plan.find({ isActive: true });
        
        console.log('🔧 FIXING CUSTOM ROLES CONFIGURATION:\n');
        console.log('='.repeat(80));
        
        for (const plan of plans) {
            console.log(`\n📦 Plan: ${plan.name}`);
            console.log(`   Current canUseCustomRoles: ${plan.features.canUseCustomRoles}`);
            console.log(`   Current maxCustomRoles: ${plan.features.maxCustomRoles}`);
            
            // If plan has maxCustomRoles > 0 or -1 (unlimited), enable canUseCustomRoles
            if (plan.features.maxCustomRoles && plan.features.maxCustomRoles !== 0) {
                if (!plan.features.canUseCustomRoles) {
                    console.log(`   ⚠️  Plan has maxCustomRoles but canUseCustomRoles is false!`);
                    console.log(`   🔧 Enabling canUseCustomRoles...`);
                    
                    plan.features.canUseCustomRoles = true;
                    await plan.save();
                    
                    console.log(`   ✅ Fixed! canUseCustomRoles is now true`);
                } else {
                    console.log(`   ✅ Already correct`);
                }
            } else {
                console.log(`   ℹ️  No custom roles limit set, skipping`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('\n✅ All plans checked and fixed!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

fixCustomRolesPlans();
