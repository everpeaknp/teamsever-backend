const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Plan = require("../dist/models/Plan");

const listPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");

    const plans = await Plan.find({});
    console.log(`\n📋 Found ${plans.length} plans:`);
    
    plans.forEach(plan => {
      console.log(`\n--- Plan: ${plan.name} ---`);
      console.log(`   ID: ${plan._id}`);
      console.log(`   Max Members: ${plan.features.maxMembers}`);
      console.log(`   Is Active: ${plan.isActive}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

listPlans();
