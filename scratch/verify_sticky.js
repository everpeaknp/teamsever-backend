
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

        // Test Service directly
        console.log('\n🧪 Testing StickyNoteService.getStickyNote...');
        const note = await stickyNoteService.getStickyNote(workspaceId, userId);
        console.log('✅ Service.getStickyNote works:', note.content === "" ? "(blank)" : note.content);

        console.log('\n🧪 Testing StickyNoteService.updateStickyNote...');
        const updatedNote = await stickyNoteService.updateStickyNote(workspaceId, userId, "Test Content " + Date.now());
        console.log('✅ Service.updateStickyNote works:', updatedNote.content);

        // Verify parameter naming in controllers
        const stickyNoteController = require('../src/controllers/stickyNoteController');
        
        console.log('\n🧪 Simulating controller call with req.params.id (as in routes)...');
        // Mock req, res, next
        const mockReq = {
            params: { id: workspaceId }, // Route uses :id
            user: { id: userId },
            body: { content: "Controller Test Content" }
        };
        const mockRes = {
            status: function(code) { 
                this.statusCode = code; 
                return this; 
            },
            json: function(data) { 
                this.data = data; 
                return this; 
            }
        };
        const mockNext = (err) => { if (err) console.error('❌ Controller Error:', err); };

        try {
            await stickyNoteController.updateStickyNote(mockReq, mockRes, mockNext);
            console.log('Controller Response Data:', mockRes.data);
            if (!mockRes.data || !mockRes.data.data || !mockRes.data.data.workspace) {
                 console.log('⚠️ Controller probably failed to find workspaceId from req.params');
            }
        } catch (e) {
            console.log('❌ Controller crashed:', e.message);
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
