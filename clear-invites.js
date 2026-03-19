const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Invitation = require('./src/models/Invitation');
  
  const result = await Invitation.deleteMany({ status: 'pending' });
  console.log(`Deleted ${result.deletedCount} pending invitations.`);
  
  process.exit(0);
}
run().catch(console.error);
