/**
 * Quick verification script to check workspace API response structure
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function verifyWorkspaceResponse() {
    try {
        console.log('🔍 Verifying Workspace API Response Structure...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Import models after connection
        const Workspace = require('./dist/models/Workspace');
        const User = require('./dist/models/User');
        const WorkspaceService = require('./dist/services/workspaceService');

        // Find a workspace with a pro plan owner
        const workspace = await Workspace.findOne({ isDeleted: false })
            .populate({
                path: 'owner',
                populate: {
                    path: 'subscription.planId',
                    model: 'Plan'
                }
            });

        if (!workspace) {
            console.log('❌ No workspace found');
            process.exit(1);
        }

        console.log(`📦 Testing workspace: ${workspace.name}`);
        console.log(`👤 Owner: ${workspace.owner.name}`);
        
        if (workspace.owner.subscription?.planId) {
            console.log(`💳 Plan: ${workspace.owner.subscription.planId.name}`);
            console.log(`💰 Price: $${workspace.owner.subscription.planId.price}`);
        }

        console.log('\n🔧 Calling WorkspaceService.getWorkspaceById()...\n');
        
        const result = await WorkspaceService.getWorkspaceById(
            workspace._id.toString(),
            workspace.owner._id.toString()
        );

        console.log('📊 Response Structure:\n');
        console.log('='.repeat(80));
        console.log(JSON.stringify({
            _id: result._id,
            name: result.name,
            subscription: {
                isPaid: result.subscription?.isPaid,
                status: result.subscription?.status,
                plan: result.subscription?.plan ? {
                    name: result.subscription.plan.name,
                    features: {
                        maxCustomRoles: result.subscription.plan.features?.maxCustomRoles,
                        maxAdmins: result.subscription.plan.features?.maxAdmins,
                        canUseCustomRoles: result.subscription.plan.features?.canUseCustomRoles
                    }
                } : null,
                resolvedFeatures: result.subscription?.resolvedFeatures ? {
                    maxCustomRoles: result.subscription.resolvedFeatures.maxCustomRoles,
                    maxAdmins: result.subscription.resolvedFeatures.maxAdmins,
                    canUseCustomRoles: result.subscription.resolvedFeatures.canUseCustomRoles
                } : null
            }
        }, null, 2));
        console.log('='.repeat(80));

        // Simulate what frontend will see
        console.log('\n🎯 What Frontend Will Extract:\n');
        const resolvedFeatures = result.subscription?.resolvedFeatures;
        const planFeatures = result.subscription?.plan?.features;
        
        const maxCustomRoles = resolvedFeatures?.maxCustomRoles ?? planFeatures?.maxCustomRoles ?? 0;
        const maxAdmins = resolvedFeatures?.maxAdmins ?? planFeatures?.maxAdmins ?? 1;
        const canUseCustomRoles = resolvedFeatures?.canUseCustomRoles ?? planFeatures?.canUseCustomRoles ?? false;

        console.log(`   Max Custom Roles: ${maxCustomRoles}`);
        console.log(`   Max Admins: ${maxAdmins}`);
        console.log(`   Can Use Custom Roles: ${canUseCustomRoles}`);

        if (maxCustomRoles === 0) {
            console.log('\n   ⚠️  WARNING: Frontend will show 0/0 for custom roles!');
            console.log('   This means the backend is NOT returning resolvedFeatures correctly.');
        } else {
            console.log(`\n   ✅ SUCCESS: Frontend will show 0/${maxCustomRoles} for custom roles`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Test complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyWorkspaceResponse();
