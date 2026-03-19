const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const user = await db.collection('users').findOne({ email: 'everpeak.np@gmail.com' });
    console.log("User found:", user?._id);
    if (user) {
      const wbs = await db.collection('workspaces').find({ owner: user._id }).toArray();
      console.log("Workspaces owned by ObjectId:", wbs.map(w => w.name));
      
      const wbsString = await db.collection('workspaces').find({ owner: user._id.toString() }).toArray();
      console.log("Workspaces owned by String:", wbsString.map(w => w.name));
      
      // Also check via members array
      const wbsMemberObj = await db.collection('workspaces').find({ "members.user": user._id }).toArray();
      console.log("Workspaces member by ObjectId:", wbsMemberObj.map(w => w.name));
      
      const wbsMemberStr = await db.collection('workspaces').find({ "members.user": user._id.toString() }).toArray();
      console.log("Workspaces member by String:", wbsMemberStr.map(w => w.name));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
main();
