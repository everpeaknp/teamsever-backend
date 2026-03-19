const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('teamsever');
    console.log("--- START DIAGNOSTIC ---");
    
    const user = await db.collection('users').findOne({ email: /everpeak.np@gmail.com/i });
    if (!user) {
      console.log("USER NOT FOUND");
      return;
    }
    console.log("USER:", { id: user._id, email: user.email, name: user.name });

    const workspaces = await db.collection('workspaces').find({
      $or: [
        { owner: user._id },
        { owner: user._id.toString() },
        { "members.user": user._id },
        { "members.user": user._id.toString() }
      ]
    }).toArray();

    console.log(`FOUND ${workspaces.length} WORKSPACES`);
    workspaces.forEach(w => {
      console.log(`- ${w.name} (id: ${w._id}, isDeleted: ${w.isDeleted}, owner: ${w.owner})`);
      console.log(`  Members:`, JSON.stringify(w.members));
    });

  } catch (err) {
    console.log("ERROR:", err.message);
  } finally {
    await client.close();
    process.exit();
  }
}
main();
