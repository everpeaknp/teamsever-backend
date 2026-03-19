/**
 * Script to fix member status in existing workspaces
 * Run with: node fix-member-status.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup-clone';

async function fixMemberStatus() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));

    // Find all workspaces
    const workspaces = await Workspace.find({});
    console.log(`Found ${workspaces.length} workspaces`);

    let updatedCount = 0;
    let memberCount = 0;

    for (const workspace of workspaces) {
      let needsUpdate = false;

      // Check each member
      for (const member of workspace.members) {
        memberCount++;
        
        // If member has no status or status is inactive, set to active
        if (!member.status || member.status === 'inactive') {
          console.log(`Updating member ${member.user} in workspace ${workspace.name} from ${member.status || 'undefined'} to active`);
          member.status = 'active';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await workspace.save();
        updatedCount++;
        console.log(`✓ Updated workspace: ${workspace.name}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total workspaces: ${workspaces.length}`);
    console.log(`Total members: ${memberCount}`);
    console.log(`Workspaces updated: ${updatedCount}`);
    console.log('\n✓ Migration complete!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
}

fixMemberStatus();
