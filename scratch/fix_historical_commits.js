const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const ChatMessageSchema = new mongoose.Schema({
  type: String,
  sender: mongoose.Schema.Types.ObjectId,
  metadata: Object
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  githubUsername: String
});

const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
const User = mongoose.model("User", UserSchema);

async function fix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const targetUser = await User.findOne({ email: "ramontiwari086@gmail.com" });
    if (!targetUser) {
      console.error("User not found");
      process.exit(1);
    }

    console.log(`Found target user: ${targetUser.name} (${targetUser._id})`);

    // Find all commit messages that have "Ramoniswack" in metadata but wrong sender
    const result = await ChatMessage.updateMany(
      { 
        type: "github_commit", 
        $or: [
          { "metadata.pusher": { $regex: /^Ramoniswack$/i } },
          { "metadata.author": { $regex: /^Ramoniswack$/i } },
          { "metadata.commits.author": { $regex: /^Ramoniswack$/i } }
        ],
        sender: { $ne: targetUser._id }
      },
      { $set: { sender: targetUser._id } }
    );

    console.log(`Successfully updated ${result.modifiedCount} messages.`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fix();
