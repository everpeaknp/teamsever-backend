
require('dotenv').config();
const mongoose = require('mongoose');

async function verifySpaceEndpoints() {
    try {
        console.log('🔍 Verifying Space API Endpoints...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Import models
        const User = require('../src/models/User');
        const Workspace = require('../src/models/Workspace');
        const Space = require('../src/models/Space');
        const Folder = require('../src/models/Folder');
        const List = require('../src/models/List');
        const SpaceService = require('../src/services/spaceService');

        // Find a workspace
        const workspace = await Workspace.findOne({ isDeleted: false });
        if (!workspace) {
            console.log('❌ No workspace found');
            process.exit(1);
        }

        const workspaceId = workspace._id.toString();
        const userId = workspace.owner.toString();

        console.log(`📦 Testing Workspace: ${workspace.name} (${workspaceId})`);
        console.log(`👤 User: ${userId}\n`);

        // Test getWorkspaceSpaces
        console.log('--- Testing /api/workspaces/{workspaceId}/spaces ---');
        const spaces = await SpaceService.getWorkspaceSpaces(workspaceId, userId);
        console.log(`Retrieved ${spaces.length} spaces.`);
        if (spaces.length > 0) {
            console.log('Top space data structure checklist:');
            console.log(`- Space Name: ${spaces[0].name}`);
            console.log(`- Folders: ${spaces[0].folders?.length || 0}`);
            console.log(`- Lists: ${spaces[0].lists?.length || 0}`);
            
            if (spaces[0].folders && spaces[0].lists) {
                console.log('✅ getWorkspaceSpaces now returns folders and lists structure.\n');
            } else {
                console.log('❌ getWorkspaceSpaces is MISSING folders or lists structure.\n');
            }
        }

        // Test getSpaceById
        console.log('--- Testing /api/spaces/{id} ---');
        if (spaces.length > 0) {
            const firstSpaceId = spaces[0]._id.toString();
            console.log(`Testing with Space ID: ${firstSpaceId}`);
            const spaceDetail = await SpaceService.getSpaceById(firstSpaceId, userId);
            
            console.log('Space details checklist:');
            console.log(`- Name: ${spaceDetail.name}`);
            console.log(`- Folders: ${spaceDetail.folders?.length || 0}`);
            console.log(`- Lists: ${spaceDetail.lists?.length || 0}`);
            
            if (spaceDetail.folders && spaceDetail.lists) {
                console.log('✅ getSpaceById returned full data including folders and lists.\n');
            } else {
                console.log('⚠️  getSpaceById might be missing folders or lists.\n');
            }
        } else {
            console.log('⏭️  Skipping getSpaceById test as no spaces were found in the workspace.\n');
        }

        await mongoose.disconnect();
        console.log('✅ All tests complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during verification:', error);
        process.exit(1);
    }
}

verifySpaceEndpoints();
