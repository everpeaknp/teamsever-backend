const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../dist/models/User').default;

async function fixEmailDuplicates() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({}).sort({ createdAt: 1 });
    console.log(`Found ${users.length} total users`);

    // Group users by email
    const emailGroups = {};
    users.forEach(user => {
      const email = user.email.toLowerCase();
      if (!emailGroups[email]) {
        emailGroups[email] = [];
      }
      emailGroups[email].push(user);
    });

    // Find duplicates
    const duplicates = Object.entries(emailGroups).filter(([email, users]) => users.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate emails found!');
    } else {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate emails:\n`);
      
      for (const [email, userList] of duplicates) {
        console.log(`Email: ${email} (${userList.length} accounts)`);
        
        // Prioritize keeping account with more data
        // 1. Account with googleId (linked account)
        // 2. Account with profile picture
        // 3. Oldest account
        const sortedUsers = userList.sort((a, b) => {
          // Prefer account with Google linked
          if (a.googleId && !b.googleId) return -1;
          if (!a.googleId && b.googleId) return 1;
          
          // Prefer account with profile picture
          if (a.profilePicture && !b.profilePicture) return -1;
          if (!a.profilePicture && b.profilePicture) return 1;
          
          // Prefer older account
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        
        const keepUser = sortedUsers[0];
        const removeUsers = sortedUsers.slice(1);
        
        console.log(`  ✓ Keeping: ${keepUser._id} (created: ${keepUser.createdAt}${keepUser.googleId ? ', Google linked' : ''}${keepUser.profilePicture ? ', has picture' : ''})`);
        
        // If keeping user doesn't have Google ID but a duplicate does, copy it
        if (!keepUser.googleId) {
          const googleUser = removeUsers.find(u => u.googleId);
          if (googleUser) {
            keepUser.googleId = googleUser.googleId;
            if (googleUser.profilePicture && !keepUser.profilePicture) {
              keepUser.profilePicture = googleUser.profilePicture;
            }
            await keepUser.save();
            console.log(`  ℹ️  Copied Google ID and picture from duplicate to kept account`);
          }
        }
        
        for (const user of removeUsers) {
          console.log(`  ✗ Removing: ${user._id} (created: ${user.createdAt}${user.googleId ? ', Google linked' : ''})`);
          await User.deleteOne({ _id: user._id });
        }
        
        console.log('');
      }
      
      console.log(`✅ Removed ${duplicates.reduce((sum, [, users]) => sum + users.length - 1, 0)} duplicate accounts`);
    }

    // Ensure unique index exists
    console.log('\nEnsuring unique index on email field...');
    try {
      await User.collection.dropIndex('email_1');
      console.log('Dropped existing email index');
    } catch (err) {
      // Index might not exist, that's okay
    }

    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created unique index on email field');

    // Verify the index
    const indexes = await User.collection.indexes();
    const emailIndex = indexes.find(idx => idx.key.email === 1);
    
    if (emailIndex && emailIndex.unique) {
      console.log('✅ Email field is now unique!');
    } else {
      console.log('⚠️  Warning: Email index exists but might not be unique');
    }

    console.log('\n✅ All done! Email duplicates have been fixed.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

fixEmailDuplicates();
