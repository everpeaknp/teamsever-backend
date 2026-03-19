const mongoose = require('mongoose');
const Workspace = require('./src/models/Workspace');
const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const userIdString = '69bbf815a96fe78f716752a6'; 
    const ws = await Workspace.find({
      isDeleted: false,
      $or: [{ owner: userIdString }, { "members.user": userIdString }]
    });
    console.log("Mongoose found:", ws.map(w => w.name));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
main();
