/**
 * Fix Active Users Without Expiry Date
 * Sets 30-day expiry for all active paid users without expiresAt
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./dist/models/User');

async function fixActiveUsersExpiry() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all active paid users without expiresAt
    const usersToFix = await User.find({
      'subscription.status': 'active',
      'subscription.isPaid': true,
      $or: [
        { 'subscription.expiresAt': { $exists: false } },
        { 'subscription.expiresAt': null }
      ]
    });

    console.log(`📊 Found ${usersToFix.length} active users without expiry date\n`);

    if (usersToFix.length === 0) {
      console.log('All active users have expiry dates set.');
    } else {
      for (const user of usersToFix) {
        // Set expiry to 30 days from now
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        user.subscription.expiresAt = expiryDate;
        
        // Set paidAt to now if not set
        if (!user.subscription.paidAt) {
          user.subscription.paidAt = new Date();
        }
        
        await user.save();
        
        console.log(`✅ Fixed user: ${user.email}`);
        console.log(`   Expires: ${expiryDate.toLocaleDateString()}`);
        console.log(`   Days: 30`);
        console.log('');
      }
    }

    console.log(`\n✅ Fixed ${usersToFix.length} users!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixActiveUsersExpiry();
