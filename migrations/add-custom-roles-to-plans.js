/**
 * Migration: Add Custom Roles Feature to Existing Plans
 * 
 * This migration adds canUseCustomRoles and maxCustomRoles fields to all existing plans
 * that were created before this feature was added.
 * 
 * Default values based on plan tier:
 * - Free: canUseCustomRoles: false, maxCustomRoles: 0
 * - Pro: canUseCustomRoles: true, maxCustomRoles: 5
 * - Business: canUseCustomRoles: true, maxCustomRoles: 10
 * - Enterprise: canUseCustomRoles: true, maxCustomRoles: -1 (unlimited)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../dist/models/Plan');

async function migrateCustomRolesFeature() {
    try {
        console.log('🚀 Starting Custom Roles Feature Migration...\n');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all plans
        const plans = await Plan.find({});
        
        console.log(`📋 Found ${plans.length} plans to migrate\n`);
        console.log('='.repeat(80));
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const plan of plans) {
            console.log(`\n📦 Processing Plan: ${plan.name}`);
            console.log(`   ID: ${plan._id}`);
            console.log(`   Price: $${plan.price}/${plan.billingCycle || 'N/A'}`);
            
            // Check if plan already has custom roles fields properly set
            const hasCanUseCustomRoles = plan.features.hasOwnProperty('canUseCustomRoles');
            const hasMaxCustomRoles = plan.features.hasOwnProperty('maxCustomRoles');
            
            console.log(`   Current canUseCustomRoles: ${plan.features.canUseCustomRoles} (exists: ${hasCanUseCustomRoles})`);
            console.log(`   Current maxCustomRoles: ${plan.features.maxCustomRoles} (exists: ${hasMaxCustomRoles})`);
            
            // Determine appropriate defaults based on plan name/price
            let canUseCustomRoles = false;
            let maxCustomRoles = 0;
            
            const planNameLower = plan.name.toLowerCase();
            const price = plan.price || 0;
            
            if (planNameLower.includes('free') || price === 0) {
                // Free plan - no custom roles
                canUseCustomRoles = false;
                maxCustomRoles = 0;
                console.log(`   ℹ️  Detected as FREE plan`);
            } else if (planNameLower.includes('enterprise') || price >= 1000) {
                // Enterprise plan - unlimited custom roles
                canUseCustomRoles = true;
                maxCustomRoles = -1;
                console.log(`   ℹ️  Detected as ENTERPRISE plan`);
            } else if (planNameLower.includes('business') || price >= 500) {
                // Business plan - 10 custom roles
                canUseCustomRoles = true;
                maxCustomRoles = 10;
                console.log(`   ℹ️  Detected as BUSINESS plan`);
            } else if (planNameLower.includes('pro') || price >= 100) {
                // Pro plan - 5 custom roles
                canUseCustomRoles = true;
                maxCustomRoles = 5;
                console.log(`   ℹ️  Detected as PRO plan`);
            } else {
                // Default for other paid plans - 3 custom roles
                canUseCustomRoles = true;
                maxCustomRoles = 3;
                console.log(`   ℹ️  Detected as OTHER PAID plan`);
            }
            
            // Only update if fields are missing or set to default/incorrect values
            let needsUpdate = false;
            
            if (!hasCanUseCustomRoles || plan.features.canUseCustomRoles !== canUseCustomRoles) {
                needsUpdate = true;
            }
            
            if (!hasMaxCustomRoles || (plan.features.maxCustomRoles === undefined || plan.features.maxCustomRoles === null)) {
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                console.log(`   🔧 Updating plan with:`);
                console.log(`      - canUseCustomRoles: ${canUseCustomRoles}`);
                console.log(`      - maxCustomRoles: ${maxCustomRoles}`);
                
                plan.features.canUseCustomRoles = canUseCustomRoles;
                plan.features.maxCustomRoles = maxCustomRoles;
                
                await plan.save();
                
                console.log(`   ✅ Successfully migrated!`);
                migratedCount++;
            } else {
                console.log(`   ⏭️  Already has correct values, skipping`);
                skippedCount++;
            }
            
            console.log('-'.repeat(80));
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('\n📊 Migration Summary:');
        console.log(`   Total plans: ${plans.length}`);
        console.log(`   Migrated: ${migratedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log('\n✅ Migration completed successfully!');
        
        // Verify migration
        console.log('\n🔍 Verifying migration...\n');
        const verifyPlans = await Plan.find({});
        
        for (const plan of verifyPlans) {
            const hasCanUse = plan.features.hasOwnProperty('canUseCustomRoles');
            const hasMax = plan.features.hasOwnProperty('maxCustomRoles');
            
            if (!hasCanUse || !hasMax) {
                console.log(`   ⚠️  WARNING: Plan "${plan.name}" still missing fields!`);
            } else {
                console.log(`   ✅ ${plan.name}: canUseCustomRoles=${plan.features.canUseCustomRoles}, maxCustomRoles=${plan.features.maxCustomRoles}`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run migration
migrateCustomRolesFeature()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    });
