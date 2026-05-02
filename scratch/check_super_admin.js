const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const User = require("../dist/models/User");

const checkSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    const email = "superadmin@everacy.com";
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
    } else {
      console.log(`✅ User found:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Is Super User: ${user.isSuperUser}`);
      
      const passwordToTest = "SuperAdmin123!";
      const isMatch = await bcrypt.compare(passwordToTest, user.password);
      console.log(`   Password "SuperAdmin123!" match: ${isMatch}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkSuperAdmin();
