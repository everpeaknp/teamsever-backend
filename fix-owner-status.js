/**
 * Migration Script: Fix Owner Status
 * 
 * This script updates all workspaces to ensure the owner has status: 'active'
 * Run this once to fix existing workspaces
 * 
 * Usage: node fix-owner-status.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup-clone';

async function fixOwnerStatus() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

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

    console.log('\nFetching all workspaces...');
    const workspaces = await Workspace.find({ isDeleted: false });
    console.log(`Found ${workspaces.length} workspaces`);

    let fixedCount = 0;
    let alreadyActiveCount = 0;

    for (const workspace of workspaces) {
      // Find the owner in members array
      const ownerMemberIndex = workspace.members.findIndex(
        m => m.user.toString() === workspace.owner.toString()
      );

      if (ownerMemberIndex === -1) {
        console.log(`⚠️  Workspace "${workspace.name}" (${workspace._id}): Owner not in members array - SKIPPING`);
        continue;
      }

      const ownerMember = workspace.members[ownerMemberIndex];

      if (ownerMember.status === 'active') {
        alreadyActiveCount++;
        console.log(`✓ Workspace "${workspace.name}" (${workspace._id}): Owner already active`);
        continue;
      }

      // Fix the owner status
      workspace.members[ownerMemberIndex].status = 'active';
      await workspace.save();
      fixedCount++;
      console.log(`✓ Workspace "${workspace.name}" (${workspace._id}): Owner status updated to active`);
    }

    console.log('\n=== Summary ===');
    console.log(`Total workspaces: ${workspaces.length}`);
    console.log(`Already active: ${alreadyActiveCount}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Skipped: ${workspaces.length - alreadyActiveCount - fixedCount}`);

    console.log('\nDisconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixOwnerStatus();
