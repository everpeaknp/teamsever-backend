import mongoose from 'mongoose';
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log("--- USER SEARCH ---");
    const user = await db.collection('users').findOne({ email: /everpeak.np@gmail.com/i });
    if (!user) {
      console.log("User NOT FOUND (case-insensitive check)");
      return;
    }
    console.log("User ID:", user._id);
    console.log("User Email:", user.email);
    console.log("User Name:", user.name);
    
    console.log("\n--- WORKSPACE SEARCH (Raw Mongo) ---");
    // Find ALL workspaces involving this user
    const userId = user._id;
    const allWbs = await db.collection('workspaces').find({
      $or: [
        { owner: userId },
        { owner: userId.toString() },
        { "members.user": userId },
        { "members.user": userId.toString() }
      ]
    }).toArray();
    
    console.log(`Found ${allWbs.length} total workspaces for this user:`);
    allWbs.forEach((w, i) => {
      console.log(`\n[${i+1}] Workspace: ${w.name}`);
      console.log(`    ID: ${w._id}`);
      console.log(`    Owner: ${w.owner} (Type: ${typeof w.owner === 'object' ? 'ObjectId' : 'String'})`);
      console.log(`    isDeleted: ${w.isDeleted}`);
      console.log(`    Members:`, w.members.map((m: any) => ({ user: m.user, role: m.role })));
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}
main();
