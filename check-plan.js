/**
 * Check Plan Script
 * 
 * This script checks if a plan exists and shows its details
 * 
 * Usage: node check-plan.js <plan_id>
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup-clone';

async function checkPlan() {
  try {
    const planId = process.argv[2];
    
    if (!planId) {
      console.error('Error: Please provide a plan ID');
      console.log('Usage: node check-plan.js <plan_id>');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Plan = mongoose.model('Plan', new mongoose.Schema({
      name: String,
      price: Number,
      description: String,
      features: {
        maxWorkspaces: Number,
        maxMembers: Number,
        maxAdmins: Number,
        maxSpaces: Number,
        maxLists: Number,
        maxFolders: Number,
        maxTasks: Number,
        hasAccessControl: Boolean,
        hasGroupChat: Boolean,
        messageLimit: Number,
        announcementCooldown: Number,
        accessControlTier: String
      },
      isActive: Boolean
    }));

    console.log(`Fetching plan: ${planId}...`);
    const plan = await Plan.findById(planId);

    if (!plan) {
      console.error('❌ Plan not found!');
      console.log('\nListing all plans:');
      const allPlans = await Plan.find({});
      if (allPlans.length === 0) {
        console.log('No plans found in database!');
      } else {
        allPlans.forEach(p => {
          console.log(`- ${p.name} (${p._id}) - Active: ${p.isActive}`);
        });
      }
      process.exit(1);
    }

    console.log('✅ Plan found!\n');
    console.log('=== PLAN DETAILS ===');
    console.log(`ID: ${plan._id}`);
    console.log(`Name: ${plan.name}`);
    console.log(`Price: $${plan.price}`);
    console.log(`Description: ${plan.description}`);
    console.log(`Active: ${plan.isActive}`);
    console.log();

    console.log('=== FEATURES ===');
    console.log(`Max Workspaces: ${plan.features.maxWorkspaces === -1 ? 'Unlimited' : plan.features.maxWorkspaces}`);
    console.log(`Max Members: ${plan.features.maxMembers === -1 ? 'Unlimited' : plan.features.maxMembers}`);
    console.log(`Max Admins: ${plan.features.maxAdmins === -1 ? 'Unlimited' : plan.features.maxAdmins}`);
    console.log(`Max Spaces: ${plan.features.maxSpaces === -1 ? 'Unlimited' : plan.features.maxSpaces}`);
    console.log(`Max Lists: ${plan.features.maxLists === -1 ? 'Unlimited' : plan.features.maxLists}`);
    console.log(`Max Folders: ${plan.features.maxFolders === -1 ? 'Unlimited' : plan.features.maxFolders}`);
    console.log(`Max Tasks: ${plan.features.maxTasks === -1 ? 'Unlimited' : plan.features.maxTasks}`);
    console.log(`Has Access Control: ${plan.features.hasAccessControl}`);
    console.log(`Has Group Chat: ${plan.features.hasGroupChat}`);
    console.log(`Message Limit: ${plan.features.messageLimit === -1 ? 'Unlimited' : plan.features.messageLimit}`);
    console.log(`Announcement Cooldown: ${plan.features.announcementCooldown} hours`);
    console.log(`Access Control Tier: ${plan.features.accessControlTier}`);

    console.log('\nDisconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPlan();
