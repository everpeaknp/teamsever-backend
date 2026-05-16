const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ramon/projects/everacy/teamsever-backend/.env' });

async function checkDMs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DirectMessage = mongoose.model('DirectMessage', new mongoose.Schema({}, { strict: false }));
    const Conversation = mongoose.model('Conversation', new mongoose.Schema({}, { strict: false }));

    const targetUser = await User.findOne({ email: 'everpeak.np@gmail.com' });
    const currentWorkspaceId = '69bbf827a96fe78f716752bb';

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
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`Unread conversations for ${targetUser.name}:`);
    for (const row of unreadConvs) {
      const conv = await Conversation.findById(row._id);
      const otherParticipantId = conv.participants.find(p => p.toString() !== targetUser._id.toString());
      const otherUser = await User.findById(otherParticipantId);
      console.log(`- With ${otherUser?.name} (${otherUser?.email}): ${row.count} messages`);
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkDMs();
