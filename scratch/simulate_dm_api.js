const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ramon/projects/everacy/teamsever-backend/.env' });

async function simulateApi() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DirectMessage = mongoose.model('DirectMessage', new mongoose.Schema({}, { strict: false }));
    const Conversation = mongoose.model('Conversation', new mongoose.Schema({}, { strict: false }));

    const userId = '69bbf815a96fe78f716752a6'; // EveracyAdmin
    const workspaceId = '69bbf827a96fe78f716752bb';

    const baseQuery = {
      workspace: new mongoose.Types.ObjectId(workspaceId),
      participants: new mongoose.Types.ObjectId(userId),
    };

    const conversations = await Conversation.find(baseQuery)
      .sort({ lastMessageAt: -1 })
      .lean();

    console.log(`Found ${conversations.length} raw conversations in workspace.`);

    const conversationIds = conversations.map(c => c._id);
    const unreadRows = await DirectMessage.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      { $group: { _id: "$conversation", unreadCount: { $sum: 1 } } },
    ]);

    const unreadMap = new Map(
      unreadRows.map(row => [row._id.toString(), row.unreadCount || 0])
    );

    const dedupMap = new Map();
    for (const conv of conversations) {
      const otherParticipant = (conv.participants || []).find(
        p => p.toString() !== userId
      );
      const dedupKey = otherParticipant ? otherParticipant.toString() : conv._id.toString();
      if (!dedupMap.has(dedupKey)) {
        dedupMap.set(dedupKey, {
          _id: conv._id,
          otherParticipant,
          unreadCount: unreadMap.get(conv._id.toString()) || 0,
        });
      }
    }

    const finalConversations = Array.from(dedupMap.values());
    console.log(`Final deduped conversations: ${finalConversations.length}`);

    let totalUnread = 0;
    for (const c of finalConversations) {
      if (c.unreadCount > 0) {
        const otherUser = await User.findById(c.otherParticipant);
        console.log(` - Participant ${otherUser?.name}: ${c.unreadCount} unread`);
        totalUnread += c.unreadCount;
      }
    }

    console.log(`Total sum of unread messages: ${totalUnread}`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
simulateApi();
