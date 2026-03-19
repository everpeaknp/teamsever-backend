const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Plan = require('../dist/models/Plan');

async function fixBusinessPlan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const businessPlan = await Plan.findOne({ name: 'Business' });
    if (businessPlan) {
      console.log('Found Business plan');
      console.log('Current values:');
      console.log(`  Monthly: ${businessPlan.pricePerMemberMonthly}`);
      console.log(`  Annual: ${businessPlan.pricePerMemberAnnual}`);
      console.log(`  Legacy Price: ${businessPlan.price}`);

      // Reset to correct values from legacy price
      businessPlan.pricePerMemberMonthly = businessPlan.price || businessPlan.basePrice || 999;
      businessPlan.pricePerMemberAnnual = (businessPlan.price || businessPlan.basePrice || 999) * 10;
      await businessPlan.save();

      console.log('\nUpdated values:');
      console.log(`  Monthly: ${businessPlan.pricePerMemberMonthly}`);
      console.log(`  Annual: ${businessPlan.pricePerMemberAnnual}`);
      console.log('\n✅ Business plan fixed!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixBusinessPlan();
