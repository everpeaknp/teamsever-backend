import mongoose from "mongoose";

require("dotenv").config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  throw new Error("MONGODB_URI or MONGO_URI must be set");
}

async function ensureClockStatusIndex() {
  try {
    await mongoose.connect(uri);
    const indexName = await mongoose.connection.db!.collection("timeentries").createIndex(
      { workspace: 1, isRunning: 1, isDeleted: 1, startTime: -1 },
      { name: "workspace_running_deleted_start_desc" },
    );
    console.log(`Clock-status index ready: ${indexName}`);
  } finally {
    await mongoose.disconnect();
  }
}

ensureClockStatusIndex().catch((error) => {
  console.error("Failed to ensure the clock-status index:", error);
  process.exitCode = 1;
});
