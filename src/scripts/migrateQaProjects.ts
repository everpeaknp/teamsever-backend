/**
 * Backfill workspace-scoped Quality records into each workspace's root QA project
 * and replace the old workspace-wide module-name uniqueness index.
 * Run with `npm run migrate:qa-projects` after setting MONGODB_URI.
 */
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);

const Workspace = require("../models/Workspace");
const QaProject = require("../models/QaProject");
const QaModule = require("../models/QaModule");
const TestCase = require("../models/TestCase");
const TestSuite = require("../models/TestSuite");
const TestPlan = require("../models/TestPlan");
const TestRun = require("../models/TestRun");
const TestExecution = require("../models/TestExecution");
const TestCaseRevision = require("../models/TestCaseRevision");
const QaReportSnapshot = require("../models/QaReportSnapshot");
const QaCaseImportBatch = require("../models/QaCaseImportBatch");
const Task = require("../models/Task");

const migrate = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);

  const indexes = await QaModule.collection.indexes();
  const legacyUniqueNameIndex = indexes.find((index: any) => index.name === "workspace_1_name_1");
  if (legacyUniqueNameIndex) await QaModule.collection.dropIndex(legacyUniqueNameIndex.name);

  const workspaces = await Workspace.find({ isDeleted: false }).select("_id owner").lean();
  const scopedModels = [QaModule, TestCase, TestSuite, TestPlan, TestRun, TestExecution, TestCaseRevision, QaReportSnapshot, QaCaseImportBatch];
  let migrated = 0;
  for (const workspace of workspaces) {
    const project = await QaProject.findOneAndUpdate(
      { workspace: workspace._id, scopeType: "workspace", folder: null },
      { $set: { isArchived: false }, $setOnInsert: { name: "Workspace project", scopeType: "workspace", folder: null, space: null, settingsOverrides: {}, createdBy: workspace.owner } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    for (const model of scopedModels) {
      const result = await model.updateMany(
        { workspace: workspace._id, $or: [{ project: null }, { project: { $exists: false } }] },
        { $set: { project: project._id } },
      );
      migrated += result.modifiedCount || result.nModified || 0;
    }
    const taskResult = await Task.updateMany(
      { workspace: workspace._id, workItemType: "bug", qaSourceExecution: { $exists: true }, $or: [{ qaProject: null }, { qaProject: { $exists: false } }] },
      { $set: { qaProject: project._id } },
    );
    migrated += taskResult.modifiedCount || taskResult.nModified || 0;
  }

  await QaModule.collection.createIndex(
    { workspace: 1, project: 1, name: 1 },
    { unique: true, collation: { locale: "en", strength: 2 }, name: "workspace_1_project_1_name_1" },
  );
  console.log(`QA project backfill complete. Updated ${migrated} records across ${workspaces.length} workspaces.`);
};

migrate().catch((error: any) => {
  console.error("QA project migration failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});

export {};
