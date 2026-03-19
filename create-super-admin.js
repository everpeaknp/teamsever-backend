const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const User = require("./dist/models/User");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const createSuperAdmin = async () => {
  try {
    await connectDB();

    const superUserEmail = process.env.SUPER_USER_EMAIL || "superadmin@everacy.com";
    const superUserPassword = process.env.SUPER_USER_PASSWORD || "SuperAdmin123!";

    console.log("\n🔍 Checking for existing super admin...");
    
    let superUser = await User.findOne({ email: superUserEmail });

    if (superUser) {
      console.log("📝 Super admin found. Updating...");
      
      // Update password and ensure isSuperUser is true
      const hashedPassword = await bcrypt.hash(superUserPassword, 10);
      superUser.password = hashedPassword;
      superUser.isSuperUser = true;
      superUser.name = "Super Admin";
      await superUser.save();

      console.log("\n✅ Super Admin Updated Successfully!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("👑 Super Admin Credentials:");
      console.log(`   Email:    ${superUserEmail}`);
      console.log(`   Password: ${superUserPassword}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("\n🔐 Login at: http://localhost:3000/login");
      console.log("🎛️  Dashboard: http://localhost:3000/super-admin");
      console.log("\n⚠️  IMPORTANT: Change this password in production!");
    } else {
      console.log("📝 Creating new super admin...");
      
      const hashedPassword = await bcrypt.hash(superUserPassword, 10);
      
      superUser = await User.create({
        name: "Super Admin",
        email: superUserEmail,
        password: hashedPassword,
        isSuperUser: true
      });

      console.log("\n✅ Super Admin Created Successfully!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("👑 Super Admin Credentials:");
      console.log(`   Email:    ${superUserEmail}`);
      console.log(`   Password: ${superUserPassword}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("\n🔐 Login at: http://localhost:3000/login");
      console.log("🎛️  Dashboard: http://localhost:3000/super-admin");
      console.log("\n⚠️  IMPORTANT: Change this password in production!");
    }

    // Verify the user can be found and authenticated
    console.log("\n🧪 Testing authentication...");
    const testUser = await User.findOne({ email: superUserEmail });
    if (testUser) {
      const isPasswordCorrect = await bcrypt.compare(superUserPassword, testUser.password);
      if (isPasswordCorrect && testUser.isSuperUser) {
        console.log("✅ Authentication test passed!");
        console.log(`   User ID: ${testUser._id}`);
        console.log(`   Is Super User: ${testUser.isSuperUser}`);
      } else {
        console.log("❌ Authentication test failed!");
        if (!isPasswordCorrect) console.log("   Password mismatch");
        if (!testUser.isSuperUser) console.log("   isSuperUser flag not set");
      }
    }

    console.log("\n✅ Setup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error creating super admin:", error);
    process.exit(1);
  }
};

createSuperAdmin();
