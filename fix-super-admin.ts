import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./src/models/User";

dotenv.config();

const fixSuperAdmin = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB");

    const email = process.env.SUPER_USER_EMAIL || "superadmin@example.com";
    const password = process.env.SUPER_USER_PASSWORD || "SuperAdmin123!";

    console.log(`Checking for user: ${email}`);
    let user = await User.findOne({ email: email.toLowerCase() });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (user) {
      console.log("Found existing user. Updating to Super Admin...");
      user.password = hashedPassword;
      user.isSuperUser = true;
      await user.save();
      console.log("✅ User updated to Super Admin successfully!");
    } else {
      console.log("User not found. Creating new Super Admin...");
      user = await User.create({
        name: "Super Admin",
        email: email.toLowerCase(),
        password: hashedPassword,
        isSuperUser: true,
      });
      console.log("✅ New Super Admin created successfully!");
    }

    console.log("\n-------------------------------------------");
    console.log("CREDENTIALS TO USE:");
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log("-------------------------------------------\n");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

fixSuperAdmin();
