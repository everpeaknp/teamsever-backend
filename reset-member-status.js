/**
 * Reset all workspace members' status to 'inactive'
 * This fixes the issue where users appear as "clocked in" by default
 * 
 * Run with: node reset-member-status.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup';

async function resetMemberStatus() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));

    console.log('\n📊 Fetching all workspaces...');
    const workspaces = await Workspace.find({});
    console.log(`Found ${workspaces.length} workspaces`);

    let totalMembers = 0;
    let updatedMembers = 0;

    for (const workspace of workspaces) {
      if (workspace.members && workspace.members.length > 0) {
        totalMembers += workspace.members.length;
        
        let workspaceUpdated = false;
        workspace.members.forEach((member) => {
          if (member.status === 'active' || !member.status) {
            member.status = 'inactive';
            updatedMembers++;
            workspaceUpdated = true;
          }
        });

        if (workspaceUpdated) {
          workspace.markModified('members');
          await workspace.save();
          console.log(`✅ Updated workspace: ${workspace.name} (${workspace.members.length} members)`);
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`Total workspaces: ${workspaces.length}`);
    console.log(`Total members: ${totalMembers}`);
    console.log(`Updated members: ${updatedMembers}`);
    console.log('\n✅ All members have been reset to "inactive" (clocked out) status');
    console.log('Users will need to manually clock in to start tracking time');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

resetMemberStatus();
