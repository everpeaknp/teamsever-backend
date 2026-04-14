
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const HierarchyService = require('../src/services/hierarchyService').default;
const Workspace = require('./src/models/Workspace');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const workspaceId = '69bbf827a96fe78f716752bb';
    const userId = '69bcc46789cab60dfa454499';
    
    console.log('Testing hierarchy for user:', userId);
    const result = await HierarchyService.getWorkspaceHierarchy(workspaceId, userId);
    
    console.log('Result Spaces Count:', result.spaces.length);
    if (result.spaces.length > 0) {
      console.log('First Space Name:', result.spaces[0].name);
      console.log('First Space Folders:', result.spaces[0].folders.length);
      console.log('First Space Lists:', result.spaces[0].lists.length);
    } else {
      console.log('No spaces found for this user.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

test();
