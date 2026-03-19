/**
 * Quick fix to update all inactive members to active
 * Run with: node quick-fix-members.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clickup-clone';

async function quickFix() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Update all members with status 'inactive' or no status to 'active'
    const result = await db.collection('workspaces').updateMany(
      {},
      {
        $set: {
          'members.$[elem].status': 'active'
        }
      },
      {
        arrayFilters: [
          {
            $or: [
              { 'elem.status': { $exists: false } },
              { 'elem.status': 'inactive' }
            ]
          }
        ]
      }
    );

    console.log('=== Update Results ===');
    console.log(`Matched workspaces: ${result.matchedCount}`);
    console.log(`Modified workspaces: ${result.modifiedCount}`);
    console.log('\n✓ All members updated to active status!');
    console.log('\nPlease restart your backend server for changes to take effect.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
}

quickFix();
