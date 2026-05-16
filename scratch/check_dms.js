const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ramon/projects/everacy/teamsever-backend/.env' });

async function checkDMs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Conversation = mongoose.model('Conversation', new mongoose.Schema({}, { strict: false }));
    const DirectMessage = mongoose.model('DirectMessage', new mongoose.Schema({}, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({}).select('name email');
    console.log('\n--- Users ---');
    users.forEach(u => console.log(`${u._id}: ${u.name} (${u.email})`));

    const conversations = await Conversation.find({});
    console.log('\n--- Conversations ---');
    for (const conv of conversations) {
      const messages = await DirectMessage.find({ conversation: conv._id });
      console.log(`Conv ${conv._id} [${conv.conversationKey}]: ${messages.length} messages`);
      
      for (const msg of messages) {
        console.log(`  Msg ${msg._id} from ${msg.sender}: "${msg.content.substring(0, 20)}..." | ReadBy: ${msg.readBy}`);
      }
    }

    // Find EveracyAdmin user
    const targetUser = await User.findOne({ 
      $or: [
        { name: /EveracyAdmin/i },
        { email: /everpeak.np@gmail.com/i }
      ]
    });

    if (!targetUser) {
      console.log('\nEveracyAdmin user not found!');
      process.exit(1);
    }

    console.log(`\nFound User: ${targetUser.name} (${targetUser._id})`);

    const unreadCount = await DirectMessage.countDocuments({
      sender: { $ne: targetUser._id },
      readBy: { $ne: targetUser._id }
    });
    
    console.log(`Global unread count for ${targetUser.name}: ${unreadCount}`);

    // Breakdown by workspace
    const unreadByWorkspace = await DirectMessage.aggregate([
      {
        $match: {
          sender: { $ne: targetUser._id },
          readBy: { $ne: targetUser._id }
        }
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversation",
          foreignField: "_id",
          as: "conv"
        }
      },
      { $unwind: "$conv" },
      {
        $group: {
          _id: "$conv.workspace",
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n--- Unread count by Workspace ---');
    for (const row of unreadByWorkspace) {
      const workspace = await Workspace.findById(row._id);
      console.log(`Workspace ${row._id} [${workspace?.name}]: ${row.count} unread`);
    }

    // List unread conversations in current workspace
    const currentWorkspaceId = '69bbf827a96fe78f716752bb';
    console.log(`\n--- Unread Conversations in Workspace ${currentWorkspaceId} ---`);
    const unreadConvs = await DirectMessage.aggregate([
      {
        $match: {
          sender: { $ne: targetUser._id },
          readBy: { $ne: targetUser._id }
        }
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversation",
          foreignField: "_id",
          as: "conv"
        }
      },
      { $unwind: "$conv" },
      {
        $match: { "conv.workspace": new mongoose.Types.ObjectId(currentWorkspaceId) }
      },
      {
        $group: {
          _id: "$conversation",
          count: { $sum: 1 },
          lastMessage: { $last: "$content" },
          lastSender: { $last: "$sender" }
        }
      }
    ]);

    for (const row of unreadConvs) {
      const conv = await Conversation.findById(row._id);
      const otherParticipant = conv.participants.find(p => p.toString() !== targetUser._id.toString());
      const otherUser = await User.findById(otherParticipant);
      console.log(`Conv ${row._id} with ${otherUser?.name}: ${row.count} unread. Last message: "${row.lastMessage.substring(0, 30)}"`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDMs();
