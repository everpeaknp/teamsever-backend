/**
 * Migration Script: Fix Subscription Status
 * 
 * This script:
 * 1. Removes any "trial" status (changes to "free")
 * 2. Ensures all users have proper subscription status
 * 3. Expires any active subscriptions past their expiry date
 * 4. Cleans up subscription data
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./dist/models/User');

async function fixSubscriptionStatus() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const now = new Date();
    let fixedCount = 0;
    let expiredCount = 0;

    // Use updateMany to fix all users without subscription.status in one go
    const result = await User.updateMany(
      {
        $or: [
          { 'subscription.status': { $exists: false } },
          { 'subscription.status': null },
          { 'subscription.status': 'trial' }
        ]
      },
      {
        $set: {
          'subscription.status': 'free',
          'subscription.isPaid': false
        },
        $unset: {
          'subscription.expiresAt': '',
          'subscription.paidAt': ''
        }
      }
    );

    console.log(`✅ Fixed ${result.modifiedCount} users with missing/invalid status\n`);
    fixedCount = result.modifiedCount;

    // Now check for expired active subscriptions
    const expiredUsers = await User.find({
      'subscription.isPaid': true,
      'subscription.status': 'active',
      'subscription.expiresAt': { $lte: now }
    });

    for (const user of expiredUsers) {
      user.subscription.status = 'expired';
      user.subscription.isPaid = false;
      await user.save();
      expiredCount++;
      console.log(`✅ Expired subscription for user: ${user.email}`);
    }

    // Get all users to show summary
    const allUsers = await User.find({});
    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   Fixed missing/invalid status: ${fixedCount}`);
    console.log(`   Expired subscriptions: ${expiredCount}`);
    console.log(`   Total fixed: ${fixedCount + expiredCount}`);

    // Show current status breakdown
    const statusBreakdown = await User.aggregate([
      {
        $group: {
          _id: '$subscription.status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    console.log('\n📈 Current Status Breakdown:');
    statusBreakdown.forEach(item => {
      console.log(`   ${item._id || 'undefined'}: ${item.count}`);
    });

    // Show paid users with days remaining
    const paidUsers = await User.find({
      'subscription.isPaid': true,
      'subscription.status': 'active'
    }).select('email subscription');

    if (paidUsers.length > 0) {
      console.log('\n💰 Active Paid Users:');
      for (const user of paidUsers) {
        if (user.subscription.expiresAt) {
          const daysLeft = Math.ceil((new Date(user.subscription.expiresAt) - now) / (1000 * 60 * 60 * 24));
          console.log(`   ${user.email}: ${daysLeft} days remaining`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixSubscriptionStatus();
