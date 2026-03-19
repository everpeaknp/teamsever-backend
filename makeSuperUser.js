const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://everpeaknp_db_user:XJidwXsB5PIpIlGo@cluster0.bko0r2y.mongodb.net/teamsever?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const result = await db.collection('users').updateMany(
      { email: { $in: ['ramontiwari086@gmail.com', 'aashisacharya60@gmail.com'] } },
      { $set: { isSuperUser: true } }
    );
    
    console.log(`Updated ${result.modifiedCount} users to Super User.`);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
