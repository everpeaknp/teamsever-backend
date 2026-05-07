const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const ChatMessage = require('../src/models/ChatMessage');
    const channelId = '69fc480a64e62dccdd974771';
    
    const messages = await ChatMessage.find({ channel: channelId, type: 'github_commit' });
    console.log(`Found ${messages.length} messages`);
    
    for (const msg of messages) {
      const metadata = msg.metadata;
      if (metadata && !metadata.commits) {
        const author = metadata.author || metadata.pusher || 'Unknown';
        const branchName = metadata.branchName || metadata.branch || 'unknown';
        const repoName = metadata.repoName || 'unknown';
        const commits = [{ 
          author: author, 
          message: metadata.commitMessage || msg.content, 
          url: metadata.url || '#' 
        }];
        
        await ChatMessage.updateOne(
          { _id: msg._id }, 
          { 
            $set: { 
              'metadata.commits': commits, 
              'metadata.branchName': branchName, 
              'metadata.repoName': repoName 
            } 
          }
        );
        console.log(`Updated ${msg._id}`);
      }
    }
    
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
