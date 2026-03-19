/**
 * Check Active Paid Users
 * Shows details of all active paid subscriptions
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./dist/models/User');

async function checkActiveUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const now = new Date();

    // Find all active paid users
    const activeUsers = await User.find({
      'subscription.status': 'active'
    });

    console.log(`📊 Found ${activeUsers.length} active users\n`);

    if (activeUsers.length === 0) {
      console.log('No active paid users found.');
    } else {
      for (const user of activeUsers) {
        console.log(`👤 User: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Status: ${user.subscription.status}`);
        console.log(`   Paid: ${user.subscription.isPaid}`);
        console.log(`   Plan ID: ${user.subscription.planId || 'No plan'}`);
        
        if (user.subscription.expiresAt) {
          const expiryDate = new Date(user.subscription.expiresAt);
          const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          console.log(`   Expires: ${expiryDate.toLocaleDateString()}`);
          console.log(`   Days Remaining: ${daysLeft}`);
        } else {
          console.log(`   Expires: Not set`);
          console.log(`   Days Remaining: N/A`);
        }
        
        if (user.subscription.paidAt) {
          console.log(`   Paid At: ${new Date(user.subscription.paidAt).toLocaleDateString()}`);
        }
        
        console.log('');
      }
    }

    // Also check free users
    const freeUsers = await User.find({
      'subscription.status': 'free'
    }).limit(5);

    console.log(`\n📊 Sample Free Users (showing 5):\n`);
    for (const user of freeUsers) {
      console.log(`👤 ${user.email}`);
      console.log(`   Status: ${user.subscription.status}`);
      console.log(`   Paid: ${user.subscription.isPaid}`);
      console.log('');
    }

    console.log('✅ Check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

checkActiveUsers();
