
require('dotenv').config();
const mongoose = require('mongoose');

async function verifyStickyNote() {
    try {
        console.log('🔍 Verifying Sticky Note API...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Workspace = require('../src/models/Workspace');
        const User = require('../src/models/User');
        const StickyNote = require('../src/models/StickyNote');
        const stickyNoteService = require('../src/services/stickyNoteService');

        // Find a workspace and a user
        const workspace = await Workspace.findOne({ isDeleted: false });
        const user = await User.findOne();

        if (!workspace) {
            console.log('❌ Workspace not found (isDeleted: false)');
            const anyWorkspace = await Workspace.findOne();
            if (anyWorkspace) console.log('Found an existing workspace but it might be deleted:', anyWorkspace._id);
            process.exit(1);
        }

        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log(`📦 Testing with Workspace: ${workspace.name} (${workspace._id})`);
        console.log(`👤 Testing with User: ${user.name} (${user._id})`);

        const workspaceId = workspace._id.toString();
        const userId = user._id.toString();

        // Test Service sequence
        console.log('\n🧪 Testing Full Cycle (GET -> PATCH -> GET)...');
        
        console.log('1. Initial GET...');
        const initialNote = await stickyNoteService.getStickyNote(workspaceId, userId);
        console.log(`   Initial Content: "${initialNote.content}"`);
        console.log(`   Initial Workspace ID: ${initialNote.workspace}`);

        const testContent = "Test Content " + Date.now();
        console.log(`\n2. Performing PATCH with: "${testContent}"...`);
        await stickyNoteService.updateStickyNote(workspaceId, userId, testContent);

        console.log('\n3. Verifying with final GET...');
        const finalNote = await stickyNoteService.getStickyNote(workspaceId, userId);
        console.log(`   Final Content: "${finalNote.content}"`);
        console.log(`   Final Workspace ID: ${finalNote.workspace}`);

        if (finalNote.content === testContent && finalNote.workspace.toString() === workspaceId) {
            console.log('\n✅ PERSISTENCE SUCCESS: Content and Workspace ID are correct.');
        } else {
            console.log('\n❌ PERSISTENCE FAILURE: Content or Workspace ID dismatch.');
            console.log(`   Expected Workspace: ${workspaceId}, Got: ${finalNote.workspace}`);
        }

        // Verify Controller Param Mapping
        console.log('\n🧪 Verifying Controller Parameter Mapping...');
        const stickyNoteController = require('../src/controllers/stickyNoteController');
        const mockReq = {
            params: { workspaceId: workspaceId }, // This is what we fixed in routes
            user: { id: userId },
            body: { content: "Controller Content " + Date.now() }
        };
        const mockRes = {
            status: function() { return this; },
            json: function(data) { this.data = data; return this; }
        };
        const mockNext = (err) => { if (err) console.error('Controller Error:', err); };

        await stickyNoteController.updateStickyNote(mockReq, mockRes, mockNext);
        
        if (mockRes.data?.data?.workspace?.toString() === workspaceId) {
            console.log('✅ CONTROLLER SUCCESS: Correct workspaceId extracted from req.params.');
        } else {
            console.log('❌ CONTROLLER FAILURE: workspaceId is still null or incorrect in controller response.');
            console.log('   Response Data:', JSON.stringify(mockRes.data, null, 2));
        }

        await mongoose.disconnect();
        console.log('\n✅ Script complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyStickyNote();
