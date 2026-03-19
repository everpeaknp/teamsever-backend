const mongoose = require('mongoose');
require('dotenv').config();

const Invitation = require('./dist/models/Invitation').default || require('./dist/models/Invitation');

async function cleanupInvitations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all invitations
    const allInvitations = await Invitation.find({});
    console.log(`\n📊 Total invitations in database: ${allInvitations.length}`);

    // Group by status
    const byStatus = {};
    allInvitations.forEach(inv => {
      byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    });
    console.log('📈 Invitations by status:', byStatus);

    // Find expired invitations that are still marked as pending
    const expiredButPending = await Invitation.find({
      status: 'pending',
      expiresAt: { $lt: new Date() }
    });

    if (expiredButPending.length > 0) {
      console.log(`\n⚠️  Found ${expiredButPending.length} expired invitations still marked as pending`);
      
      // Update them to expired
      const result = await Invitation.updateMany(
        { status: 'pending', expiresAt: { $lt: new Date() } },
        { $set: { status: 'expired' } }
      );
      console.log(`✅ Updated ${result.modifiedCount} invitations to expired status`);
    } else {
      console.log('\n✅ No expired invitations found with pending status');
    }

    // Show recent pending invitations
    const recentPending = await Invitation.find({ status: 'pending' })
      .sort('-createdAt')
      .limit(10);

    if (recentPending.length > 0) {
      console.log('\n📋 Pending invitations:');
      recentPending.forEach(inv => {
        const expiresIn = Math.ceil((inv.expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        const isExpired = inv.expiresAt < new Date();
        console.log(`  - ${inv.email} - ${isExpired ? '❌ EXPIRED' : `✅ expires in ${expiresIn} days`}`);
        console.log(`    Token: ${inv.token.substring(0, 20)}...`);
        console.log(`    Status: ${inv.status}`);
      });
    }

    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupInvitations();
