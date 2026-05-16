const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ramon/projects/everacy/teamsever-backend/.env' });

async function checkDMs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const DirectMessage = mongoose.model('DirectMessage', new mongoose.Schema({}, { strict: false }));
    const Conversation = mongoose.model('Conversation', new mongoose.Schema({}, { strict: false }));
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));

    const targetUser = await User.findOne({ email: 'everpeak.np@gmail.com' });
    if (!targetUser) {
      console.log('User not found');
      process.exit(1);
    }

    console.log(`User: ${targetUser.name} (${targetUser._id})`);

    const unreadCountGlobal = await DirectMessage.countDocuments({
      sender: { $ne: targetUser._id },
      readBy: { $ne: targetUser._id }
    });
    console.log(`Global unread count: ${unreadCountGlobal}`);

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

    console.log(`Unread conversations in workspace ${currentWorkspaceId}: ${unreadConvs.length}`);
    let totalInWorkspace = 0;
    for (const row of unreadConvs) {
      totalInWorkspace += row.count;
      console.log(` - Conv ${row._id}: ${row.count} unread`);
    }
    console.log(`Total unread in workspace: ${totalInWorkspace}`);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkDMs();
