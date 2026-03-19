/**
 * Check Workspace Members Script
 * 
 * This script checks the member status for a specific workspace
 * 
 * Usage: node check-workspace-members.js <workspace_id>
 * Example: node check-workspace-members.js 69a156b469bc3277a2392a84
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup-clone';

async function checkWorkspaceMembers() {
  try {
    const workspaceId = process.argv[2];
    
    if (!workspaceId) {
      console.error('Error: Please provide a workspace ID');
      console.log('Usage: node check-workspace-members.js <workspace_id>');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({
      name: String,
      owner: mongoose.Schema.Types.ObjectId,
      members: [{
        user: mongoose.Schema.Types.ObjectId,
        role: String,
        status: String
      }],
      isDeleted: Boolean
    }));

    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      email: String,
      subscription: {
        planId: mongoose.Schema.Types.ObjectId,
        isPaid: Boolean,
        status: String
      }
    }));

    const Plan = mongoose.model('Plan', new mongoose.Schema({
      name: String,
      features: {
        maxMembers: Number
      }
    }));

    console.log(`Fetching workspace: ${workspaceId}...`);
    const workspace = await Workspace.findById(workspaceId)
      .populate('members.user', 'name email')
      .populate('owner', 'name email subscription');

    if (!workspace) {
      console.error('Workspace not found!');
      process.exit(1);
    }

    console.log('=== WORKSPACE INFO ===');
    console.log(`Name: ${workspace.name}`);
    console.log(`ID: ${workspace._id}`);
    console.log(`Deleted: ${workspace.isDeleted}`);
    console.log();

    // Get owner details
    const owner = await User.findById(workspace.owner).populate('subscription.planId');
    
    console.log('=== OWNER INFO ===');
    console.log(`Name: ${owner.name}`);
    console.log(`Email: ${owner.email}`);
    console.log(`ID: ${owner._id}`);
    
    if (owner.subscription && owner.subscription.planId) {
      console.log(`Plan: ${owner.subscription.planId.name}`);
      console.log(`Max Members: ${owner.subscription.planId.features?.maxMembers || 'Not set'}`);
      console.log(`Is Paid: ${owner.subscription.isPaid}`);
      console.log(`Status: ${owner.subscription.status}`);
    } else {
      console.log('Plan: None (Free tier)');
    }
    console.log();

    console.log('=== MEMBERS ===');
    console.log(`Total members in array: ${workspace.members.length}`);
    
    const activeMembers = workspace.members.filter(m => m.status === 'active');
    const inactiveMembers = workspace.members.filter(m => m.status === 'inactive' || !m.status);
    
    console.log(`Active members: ${activeMembers.length}`);
    console.log(`Inactive members: ${inactiveMembers.length}`);
    console.log();

    if (activeMembers.length > 0) {
      console.log('--- Active Members ---');
      activeMembers.forEach((member, index) => {
        const isOwner = member.user._id.toString() === workspace.owner.toString();
        console.log(`${index + 1}. ${member.user.name} (${member.user.email})`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Status: ${member.status}`);
        console.log(`   Is Owner: ${isOwner}`);
        console.log();
      });
    }

    if (inactiveMembers.length > 0) {
      console.log('--- Inactive Members ---');
      inactiveMembers.forEach((member, index) => {
        console.log(`${index + 1}. ${member.user.name} (${member.user.email})`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Status: ${member.status || 'undefined'}`);
        console.log();
      });
    }

    console.log('=== LIMIT CHECK ===');
    if (owner.subscription && owner.subscription.planId && owner.subscription.planId.features) {
      const maxMembers = owner.subscription.planId.features.maxMembers;
      const currentActive = activeMembers.length;
      
      console.log(`Current active members: ${currentActive}`);
      console.log(`Max allowed members: ${maxMembers === -1 ? 'Unlimited' : maxMembers}`);
      
      if (maxMembers === -1) {
        console.log('Status: ✅ Can add unlimited members');
      } else if (currentActive < maxMembers) {
        console.log(`Status: ✅ Can add ${maxMembers - currentActive} more member(s)`);
      } else {
        console.log('Status: ❌ Member limit reached');
      }
    } else {
      console.log('⚠️  No plan assigned to owner!');
      console.log('The owner needs a plan assigned by the super admin.');
      console.log('Current status: isPaid =', owner.subscription?.isPaid || false);
      console.log('Current status: planId =', owner.subscription?.planId || 'null');
      console.log('\nTo fix: Super admin must assign a plan using:');
      console.log(`PATCH /api/super-admin/users/${owner._id}/subscription`);
      console.log('Body: { planId: "<plan_id>", isPaid: true, status: "active" }');
    }

    console.log('\nDisconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkWorkspaceMembers();
