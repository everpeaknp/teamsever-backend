export const backfillTaskWorkItemType = async (taskModel: any) =>
  taskModel.updateMany(
    { workItemType: { $exists: false } },
    { $set: { workItemType: "task" } },
  );

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const Task = require("../models/Task");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI or MONGO_URI is required");
  mongoose.connect(uri)
    .then(() => backfillTaskWorkItemType(Task))
    .then((result: any) => console.log(`Backfilled ${result.modifiedCount} tasks`))
    .finally(() => mongoose.disconnect())
    .catch((error: any) => { console.error(error); process.exitCode = 1; });
}
