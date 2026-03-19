const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('teamsever');
    console.log("--- TYPE DIAGNOSTIC ---");
    
    const workspace = await db.collection('workspaces').findOne({ name: 'Everacy' });
    if (!workspace) {
      console.log("EVERACY NOT FOUND");
      return;
    }

    console.log("Workspace:", workspace.name);
    console.log("Owner field type:", typeof workspace.owner === 'object' ? (workspace.owner instanceof ObjectId ? 'ObjectId' : 'Object') : typeof workspace.owner);
    console.log("Owner value:", workspace.owner);

    workspace.members.forEach((m, i) => {
      const userType = typeof m.user === 'object' ? (m.user instanceof ObjectId ? 'ObjectId' : 'Object') : typeof m.user;
      console.log(`Member[${i}] user type:`, userType, "value:", m.user);
    });

  } catch (err) {
    console.log("ERROR:", err.message);
  } finally {
    await client.close();
    process.exit();
  }
}
main();
