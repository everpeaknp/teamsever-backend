
require('dotenv').config();
const mongoose = require('mongoose');

async function verifySpaceResponse() {
    try {
        console.log('🔍 Verifying Space API Response Structure...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Import models
        const Space = require('../src/models/Space');
        const User = require('../src/models/User');
        const SpaceService = require('../src/services/spaceService');

        // Find a space
        const spaceDoc = await Space.findOne({ isDeleted: false });

        if (!spaceDoc) {
            console.log('❌ No space found');
            process.exit(1);
        }

        console.log(`📦 Testing space: ${spaceDoc.name} (${spaceDoc._id})`);
        
        // Find owner or any member for this space to act as requester
        const requesterId = spaceDoc.owner.toString();

        console.log('\n🔧 Calling SpaceService.getSpaceById()...\n');
        
        const result = await SpaceService.getSpaceById(
            spaceDoc._id.toString(),
            requesterId
        );

        console.log('📊 Response Data Keys:', Object.keys(result));
        
        if (result.folders) {
            console.log(`✅ folders field found. Count: ${result.folders.length}`);
        } else {
            console.log('❌ folders field MISSING');
        }

        if (result.lists) {
            console.log(`✅ lists field found. Count: ${result.lists.length}`);
        } else {
            console.log('❌ lists field MISSING');
        }

        await mongoose.disconnect();
        console.log('\n✅ Test complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifySpaceResponse();
