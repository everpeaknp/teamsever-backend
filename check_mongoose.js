const mongoose = require('mongoose');
const Workspace = require('./src/models/Workspace');
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  mongoose.set('debug', true);
  try {
    await mongoose.connect(MONGODB_URI);
    const userId = '69bbf815a96fe78f716752a6'; 
    const userObjId = new mongoose.Types.ObjectId(userId);

    console.log("\n--- MONGOOSE QUERY ---");
    const ws = await Workspace.find({
      isDeleted: false,
      $or: [{ owner: userObjId }, { "members.user": userObjId }]
    });
    console.log("Mongoose found count:", ws.length);
    if (ws.length > 0) {
      console.log("Found names:", ws.map(w => w.name));
    }

  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit();
  }
}
main();
