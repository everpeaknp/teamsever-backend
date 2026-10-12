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

export const dropLegacyModuleNameIndex = async (collection: any) => {
  const indexes = await collection.indexes();
  const legacyIndexes = indexes.filter((index: any) =>
    index.unique === true
    && Object.keys(index.key || {}).length === 2
    && index.key?.workspace === 1
    && index.key?.name === 1,
  );
  for (const index of legacyIndexes) await collection.dropIndex(index.name);
  return legacyIndexes.map((index: any) => index.name);
};

export const dropLegacyTestCaseKeyIndex = async (collection: any) => {
  const indexes = await collection.indexes();
  const legacyIndexes = indexes.filter((index: any) =>
    index.unique === true
    && Object.keys(index.key || {}).length === 2
    && index.key?.workspace === 1
    && index.key?.key === 1,
  );
  for (const index of legacyIndexes) await collection.dropIndex(index.name);
  return legacyIndexes.map((index: any) => index.name);
};

const migrate = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);

  const droppedIndexes = await dropLegacyModuleNameIndex(QaModule.collection);
  if (droppedIndexes.length) console.log(`Removed legacy workspace-wide QA module index: ${droppedIndexes.join(", ")}`);
  const droppedCaseIndexes = await dropLegacyTestCaseKeyIndex(TestCase.collection);
  if (droppedCaseIndexes.length) console.log(`Removed legacy workspace-wide test case key index: ${droppedCaseIndexes.join(", ")}`);

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
  await TestCase.collection.createIndex(
    { workspace: 1, project: 1, key: 1 },
    { unique: true, name: "workspace_1_project_1_key_1" },
  );

  const projects = await QaProject.find({}).select("_id workspace").lean();
  for (const project of projects) {
    const [sequence] = await TestCase.aggregate([
      { $match: { workspace: project.workspace, project: project._id } },
      { $project: { value: { $convert: { input: { $substrCP: ["$key", 3, 20] }, to: "int", onError: 0, onNull: 0 } } } },
      { $group: { _id: null, max: { $max: "$value" } } },
    ]);
    await QaProject.updateOne({ _id: project._id }, { $max: { caseSequence: sequence?.max || 0 } });
  }
  console.log(`QA project backfill complete. Updated ${migrated} records across ${workspaces.length} workspaces.`);
};

if (require.main === module) {
  require("dotenv").config();
  migrate().catch((error: any) => {
    console.error("QA project migration failed:", error);
    process.exitCode = 1;
  }).finally(async () => {
    await mongoose.disconnect();
  });
}

export {};
